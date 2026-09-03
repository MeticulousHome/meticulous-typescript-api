// The client-rule state machine against fake servers: a credential is attached
// only to an origin that proves possession of the pinned key.
const assert = require('node:assert');
const http = require('node:http');
const api = require('../dist/index.js');
const Api = api.default;

const b64 = (u8) => Buffer.from(u8).toString('base64');

async function genKey() {
  const kp = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );
  const spki = new Uint8Array(
    await crypto.subtle.exportKey('spki', kp.publicKey)
  );
  return { kp, spkiB64: b64(spki), fingerprint: api.fingerprintOf(b64(spki)) };
}

async function sign(privKey, message) {
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privKey,
      message
    )
  );
  return b64(sig); // WebCrypto returns P1363 r||s
}

async function readBody(req) {
  let body = '';
  for await (const c of req) body += c;
  return body;
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

// mode: 'real' | 'noident' | 'redirect' | 'forged-fp' | 'replay-after-first'
function makeServer(opts) {
  const {
    key,
    serial,
    mode,
    signKey,
    token = 'TOKEN-123',
    challengeGate,
    credentialRedirectTarget
  } = opts;
  const state = {
    sawAuthOn: [],
    sawAuthorization: [],
    challengeCount: 0,
    firstChallengeSignature: undefined
  };
  const server = http.createServer(async (req, res) => {
    const body = await readBody(req);
    const url = req.url.split('?')[0];
    if (req.headers['authorization']) {
      state.sawAuthOn.push(url);
      state.sawAuthorization.push(req.headers['authorization']);
    }
    if (mode === 'redirect') {
      res.writeHead(302, { Location: 'http://evil.example/' });
      res.end();
      return;
    }
    if (url === '/api/v1/machine') {
      const out = { name: 'Fake', serial };
      if (mode !== 'noident') {
        out.identity = {
          alg: 'ES256',
          public_key: key.spkiB64,
          fingerprint: key.fingerprint
        };
      }
      return json(res, 200, out);
    }
    if (url === '/api/v1/identity/challenge') {
      if (mode === 'noident') return json(res, 404, { error: 'no identity' });
      state.challengeCount++;
      if (challengeGate) {
        challengeGate.started.resolve();
        await challengeGate.release.promise;
      }
      const { nonce, origin } = JSON.parse(body || '{}');
      const msg = api.buildIdentityMessage(
        serial,
        origin,
        new Uint8Array(Buffer.from(nonce, 'base64'))
      );
      let signature;
      if (mode === 'replay-after-first' && state.firstChallengeSignature) {
        signature = state.firstChallengeSignature;
      } else {
        signature = await sign((signKey || key).kp.privateKey, msg);
        state.firstChallengeSignature = signature;
      }
      return json(res, 200, {
        alg: 'ES256',
        serial,
        origin,
        nonce,
        public_key: key.spkiB64,
        fingerprint: key.fingerprint,
        signature
      });
    }
    if (url === '/api/v1/pair/request') {
      return json(res, 200, { pairing_id: 'pid', expires_in: 180 });
    }
    if (url === '/api/v1/pair/verify') {
      const out = {
        status: 'approved',
        token,
        device_id: 'd1',
        serial
      };
      if (mode !== 'noident') {
        out.identity = {
          alg: 'ES256',
          public_key: key.spkiB64,
          fingerprint: key.fingerprint
        };
      }
      return json(res, 200, out);
    }
    if (url.startsWith('/api/v1/settings')) {
      if (credentialRedirectTarget) {
        res.writeHead(302, { Location: credentialRedirectTarget });
        res.end();
        return;
      }
      if (req.headers['authorization']) {
        return json(res, 200, {});
      }
      return json(res, 401, { error: 'Unauthorized' });
    }
    json(res, 404, { error: 'nope' });
  });
  return { server, state };
}

function listen(server) {
  return new Promise((r) =>
    server.listen(0, '127.0.0.1', () => r(server.address().port))
  );
}

function listenOn(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function challengeGate() {
  return { started: deferred(), release: deferred() };
}

(async () => {
  let pass = 0;
  const key = await genKey();
  const serial = 'MET-RULE-0001';

  // 1) happy path: pair, then a request carries the token
  {
    const { server, state } = makeServer({ key, serial, mode: 'real' });
    const port = await listen(server);
    const client = new Api({}, `http://127.0.0.1:${port}`);
    const cred = await client.completePairing('pid', '123456');
    assert.strictEqual(cred.serial, serial);
    assert.strictEqual(cred.fingerprint, key.fingerprint);
    await client.getSettings();
    assert.deepStrictEqual(
      state.sawAuthOn,
      ['/api/v1/settings/'],
      'token sent to the real machine'
    );
    server.close();
    pass++;
  }

  // 2) impostor with a DIFFERENT key at the same origin: token withheld
  {
    const other = await genKey();
    const { server, state } = makeServer({ key: other, serial, mode: 'real' });
    const port = await listen(server);
    const client = new Api({}, `http://127.0.0.1:${port}`);
    client.setCredential({
      serial,
      fingerprint: key.fingerprint,
      publicKey: key.spkiB64,
      token: 'TOKEN-123'
    });
    let threw = null;
    try {
      await client.getSettings();
    } catch (e) {
      threw = e;
    }
    assert.ok(
      threw instanceof api.MachineIdentityError,
      'impostor request throws'
    );
    assert.strictEqual(threw.result, 'mismatch');
    assert.deepStrictEqual(
      state.sawAuthOn,
      [],
      'NO Authorization ever reached the impostor'
    );
    server.close();
    pass++;
  }

  // 3) impostor that COPIES the fingerprint but cannot sign: still withheld
  {
    const other = await genKey();
    // /machine serves the REAL fingerprint+public_key, but challenges are signed
    // with `other` -> the client verifies with the pinned key and rejects.
    const { server, state } = makeServer({
      key,
      serial,
      mode: 'forged-fp',
      signKey: other
    });
    const port = await listen(server);
    const client = new Api({}, `http://127.0.0.1:${port}`);
    client.setCredential({
      serial,
      fingerprint: key.fingerprint,
      publicKey: key.spkiB64,
      token: 'T'
    });
    let threw = null;
    try {
      await client.getSettings();
    } catch (e) {
      threw = e;
    }
    assert.ok(
      threw instanceof api.MachineIdentityError && threw.result === 'mismatch',
      'forged fp, bad signature -> mismatch'
    );
    assert.deepStrictEqual(
      state.sawAuthOn,
      [],
      'no token to the forged-fp impostor'
    );
    server.close();
    pass++;
  }

  // 4) no-identity backend: completePairing refuses to pin
  {
    const { server } = makeServer({ key, serial, mode: 'noident' });
    const port = await listen(server);
    const client = new Api({}, `http://127.0.0.1:${port}`);
    let threw = null;
    try {
      await client.completePairing('pid', '123456');
    } catch (e) {
      threw = e;
    }
    assert.ok(
      threw instanceof api.MachineIdentityError &&
        threw.result === 'no_identity',
      'no-identity backend not pinned'
    );
    server.close();
    pass++;
  }

  // 5) redirect on the probe: treated as failure, token withheld
  {
    const { server, state } = makeServer({ key, serial, mode: 'redirect' });
    const port = await listen(server);
    const client = new Api({}, `http://127.0.0.1:${port}`);
    client.setCredential({
      serial,
      fingerprint: key.fingerprint,
      publicKey: key.spkiB64,
      token: 'T'
    });
    let threw = null;
    try {
      await client.getSettings();
    } catch (e) {
      threw = e;
    }
    assert.ok(threw instanceof api.MachineIdentityError, 'redirect throws');
    assert.strictEqual(threw.result, 'redirect');
    assert.deepStrictEqual(state.sawAuthOn, [], 'no token across a redirect');
    server.close();
    pass++;
  }

  // 6) the pinned public key is not enough if the server reports another serial
  {
    const { server, state } = makeServer({
      key,
      serial: 'MET-RULE-WRONG',
      mode: 'real'
    });
    const port = await listen(server);
    const client = new Api({}, `http://127.0.0.1:${port}`);
    const credential = {
      serial,
      fingerprint: key.fingerprint,
      publicKey: key.spkiB64,
      token: 'TOKEN-123'
    };
    client.setCredential(credential);
    let threw = null;
    try {
      await client.getSettings();
    } catch (e) {
      threw = e;
    }
    assert.ok(
      threw instanceof api.MachineIdentityError && threw.result === 'mismatch',
      'wrong serial -> mismatch'
    );
    assert.deepStrictEqual(
      state.sawAuthOn,
      [],
      'wrong-serial server received no credential'
    );
    assert.strictEqual(
      client.getCredential(),
      credential,
      'credential is retained for recovery'
    );
    assert.strictEqual(credential.state, 'identity_changed');
    server.close();
    pass++;
  }

  // 7) a serial that was previously pinned may not silently downgrade to legacy
  {
    const { server, state } = makeServer({ key, serial, mode: 'noident' });
    const port = await listen(server);
    const client = new Api({}, `http://127.0.0.1:${port}`);
    const credential = {
      serial,
      fingerprint: key.fingerprint,
      publicKey: key.spkiB64,
      token: 'TOKEN-123'
    };
    client.setCredential(credential);
    let threw = null;
    try {
      await client.getSettings();
    } catch (e) {
      threw = e;
    }
    assert.ok(
      threw instanceof api.MachineIdentityError &&
        threw.result === 'no_identity',
      'pinned serial losing identity -> no_identity'
    );
    assert.deepStrictEqual(
      state.sawAuthOn,
      [],
      'legacy response received no credential from a pinned client'
    );
    assert.strictEqual(credential.state, 'identity_changed');
    server.close();
    pass++;
  }

  // 8) after an impostor leaves the same origin, the genuine machine clears the
  // identity_changed state and can receive the retained credential again.
  {
    const impostor = await genKey();
    const first = makeServer({ key: impostor, serial, mode: 'real' });
    const port = await listen(first.server);
    const origin = `http://127.0.0.1:${port}`;
    const client = new Api({}, origin);
    const credential = {
      serial,
      fingerprint: key.fingerprint,
      publicKey: key.spkiB64,
      token: 'TOKEN-123'
    };
    client.setCredential(credential);
    await assert.rejects(client.getSettings(), api.MachineIdentityError);
    assert.strictEqual(credential.state, 'identity_changed');
    assert.deepStrictEqual(
      first.state.sawAuthOn,
      [],
      'impostor received no credential'
    );
    await close(first.server);

    const genuine = makeServer({ key, serial, mode: 'real' });
    await listenOn(genuine.server, port);
    try {
      await client.getSettings();
    } catch (error) {
      // Node's pooled connection can observe one ECONNRESET when the listener
      // at an origin is replaced. An unreachable result is transient and does
      // not change or erase the retained credential; the next request must
      // verify the genuine machine and recover.
      assert.ok(
        error instanceof api.MachineIdentityError &&
          error.result === 'unreachable'
      );
      await client.getSettings();
    }
    assert.strictEqual(credential.state, 'ok');
    assert.strictEqual(credential.lastOrigin, origin);
    assert.deepStrictEqual(genuine.state.sawAuthOn, ['/api/v1/settings/']);
    await close(genuine.server);
    pass++;
  }

  // 9) typed-code approval is the authority to replace an old identity pin.
  // Public pairing requests must therefore stay credential-less and must not be
  // blocked by the old key at the same origin.
  {
    const replacement = await genKey();
    const { server, state } = makeServer({
      key: replacement,
      serial,
      mode: 'real',
      token: 'TOKEN-REPLACEMENT'
    });
    const port = await listen(server);
    const client = new Api({}, `http://127.0.0.1:${port}`);
    client.setCredential({
      serial,
      fingerprint: key.fingerprint,
      publicKey: key.spkiB64,
      token: 'TOKEN-OLD'
    });

    const request = await client.requestPairing('replacement test');
    assert.strictEqual(request.data.pairing_id, 'pid');
    const credential = await client.completePairing('pid', '123456');
    assert.strictEqual(credential.fingerprint, replacement.fingerprint);
    assert.strictEqual(credential.token, 'TOKEN-REPLACEMENT');
    assert.deepStrictEqual(
      state.sawAuthOn,
      [],
      'old credential never reaches public pairing endpoints'
    );

    await client.getSettings();
    assert.deepStrictEqual(state.sawAuthorization, [
      'Bearer TOKEN-REPLACEMENT'
    ]);
    await close(server);
    pass++;
  }

  // 10) a credential replacement while an old proof is in flight must not
  // authorize the replacement token under the old key.
  {
    const replacement = await genKey();
    const gate = challengeGate();
    const { server, state } = makeServer({
      key,
      serial,
      mode: 'real',
      challengeGate: gate
    });
    const port = await listen(server);
    const client = new Api({}, `http://127.0.0.1:${port}`);
    client.setCredential({
      serial,
      fingerprint: key.fingerprint,
      publicKey: key.spkiB64,
      token: 'TOKEN-OLD'
    });

    const pending = client.getSettings();
    await gate.started.promise;
    client.setCredential({
      serial,
      fingerprint: replacement.fingerprint,
      publicKey: replacement.spkiB64,
      token: 'TOKEN-REPLACEMENT'
    });
    gate.release.resolve();

    await assert.rejects(
      pending,
      (error) =>
        error instanceof api.MachineIdentityError && error.result === 'mismatch'
    );
    assert.deepStrictEqual(
      state.sawAuthorization,
      [],
      'replacement token is withheld when only the old key was proved'
    );
    await close(server);
    pass++;
  }

  // 11) every Socket.IO auth callback forces a fresh challenge even when an
  // HTTP proof is still inside the ordinary 60-second cache.
  {
    const { server, state } = makeServer({ key, serial, mode: 'real' });
    const port = await listen(server);
    const client = new Api({}, `http://127.0.0.1:${port}`);
    await client.completePairing('pid', '123456');
    assert.strictEqual(state.challengeCount, 1);

    client.connectToSocket();
    const socket = client.getSocket();
    socket.disconnect();
    assert.strictEqual(typeof socket.auth, 'function');
    const auth = await new Promise((resolve) => socket.auth(resolve));
    assert.deepStrictEqual(auth, { token: 'TOKEN-123' });
    assert.strictEqual(
      state.challengeCount,
      2,
      'socket auth bypassed the HTTP freshness cache'
    );
    client.disconnectSocket();
    await close(server);
    pass++;
  }

  // 12) browser XHR follows redirects even when Axios maxRedirects is zero.
  // A changed responseURL must therefore fail the proof explicitly.
  {
    const { server, state } = makeServer({ key, serial, mode: 'real' });
    const port = await listen(server);
    const origin = `http://127.0.0.1:${port}`;
    const client = new Api({}, origin);
    client.setCredential({
      serial,
      fingerprint: key.fingerprint,
      publicKey: key.spkiB64,
      token: 'TOKEN-123'
    });
    client.probeAxios.defaults.adapter = async (config) => {
      const requestUrl = new URL(config.url, config.baseURL).toString();
      if (config.url.endsWith('/machine')) {
        return {
          data: {
            name: 'Fake',
            serial,
            identity: {
              alg: 'ES256',
              public_key: key.spkiB64,
              fingerprint: key.fingerprint
            }
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          request: { responseURL: `${origin}/redirected-machine` }
        };
      }
      const body = JSON.parse(config.data || '{}');
      const message = api.buildIdentityMessage(
        serial,
        body.origin,
        new Uint8Array(Buffer.from(body.nonce, 'base64'))
      );
      return {
        data: {
          fingerprint: key.fingerprint,
          signature: await sign(key.kp.privateKey, message)
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        request: { responseURL: requestUrl }
      };
    };

    await assert.rejects(
      client.getSettings(),
      (error) =>
        error instanceof api.MachineIdentityError && error.result === 'redirect'
    );
    assert.deepStrictEqual(state.sawAuthorization, []);
    await close(server);
    pass++;
  }

  // 13) an obsolete Socket.IO auth callback must not release the replacement
  // token after setCredential() has already created a new generation.
  {
    const replacement = await genKey();
    const gate = challengeGate();
    const { server } = makeServer({
      key,
      serial,
      mode: 'real',
      challengeGate: gate
    });
    const port = await listen(server);
    const client = new Api({}, `http://127.0.0.1:${port}`);
    client.setCredential({
      serial,
      fingerprint: key.fingerprint,
      publicKey: key.spkiB64,
      token: 'TOKEN-OLD'
    });
    client.connectToSocket();
    const obsoleteSocket = client.getSocket();
    const obsoleteAuth = obsoleteSocket.auth;
    client.disconnectSocket();

    const pendingAuth = new Promise((resolve) => obsoleteAuth(resolve));
    await gate.started.promise;
    client.setCredential({
      serial,
      fingerprint: replacement.fingerprint,
      publicKey: replacement.spkiB64,
      token: 'TOKEN-REPLACEMENT'
    });
    gate.release.resolve();

    assert.deepStrictEqual(
      await pendingAuth,
      {},
      'obsolete socket callback withheld the replacement token'
    );
    await close(server);
    pass++;
  }

  // 14) clearing a pin during an in-flight proof must not fall back to an
  // unrelated legacy token configured on the same client instance.
  {
    const gate = challengeGate();
    const { server, state } = makeServer({
      key,
      serial,
      mode: 'real',
      challengeGate: gate
    });
    const port = await listen(server);
    const client = new Api({}, `http://127.0.0.1:${port}`, 'TOKEN-LEGACY');
    client.setCredential({
      serial,
      fingerprint: key.fingerprint,
      publicKey: key.spkiB64,
      token: 'TOKEN-PINNED'
    });

    const pending = client.getSettings();
    await gate.started.promise;
    client.setCredential(undefined);
    gate.release.resolve();
    await assert.rejects(pending);
    assert.deepStrictEqual(
      state.sawAuthorization,
      [],
      'removed pin never falls through to the legacy bearer'
    );
    await close(server);
    pass++;
  }

  // 15) the ordinary HTTP proof is cached for less than 60 seconds, then the
  // next credentialed request must perform a fresh challenge before sending.
  {
    const { server, state } = makeServer({ key, serial, mode: 'real' });
    const port = await listen(server);
    const client = new Api({}, `http://127.0.0.1:${port}`);
    const realNow = Date.now;
    let now = realNow();
    Date.now = () => now;
    try {
      await client.completePairing('pid', '123456');
      assert.strictEqual(state.challengeCount, 1);
      await client.getSettings();
      assert.strictEqual(
        state.challengeCount,
        1,
        'an HTTP request inside the TTL reuses the proof'
      );
      now += 60_000;
      await client.getSettings();
      assert.strictEqual(
        state.challengeCount,
        2,
        'the first HTTP request at the TTL boundary proves again'
      );
    } finally {
      Date.now = realNow;
      await close(server);
    }
    pass++;
  }

  // 16) a signature captured from a valid proof cannot answer a later fresh
  // nonce after the TTL expires, so the bearer remains withheld.
  {
    const { server, state } = makeServer({
      key,
      serial,
      mode: 'replay-after-first'
    });
    const port = await listen(server);
    const client = new Api({}, `http://127.0.0.1:${port}`);
    const realNow = Date.now;
    let now = realNow();
    Date.now = () => now;
    try {
      await client.completePairing('pid', '123456');
      now += 60_000;
      await assert.rejects(
        client.getSettings(),
        (error) =>
          error instanceof api.MachineIdentityError &&
          error.result === 'mismatch'
      );
      assert.strictEqual(state.challengeCount, 2);
      assert.deepStrictEqual(
        state.sawAuthorization,
        [],
        'a replayed proof never releases the bearer'
      );
    } finally {
      Date.now = realNow;
      await close(server);
    }
    pass++;
  }

  // 17) browser XHR can also follow a redirect on the challenge endpoint. Its
  // changed effective URL is a redirect failure even if the body is well signed.
  {
    const origin = 'http://127.0.0.1:1';
    const client = new Api({}, origin);
    client.setCredential({
      serial,
      fingerprint: key.fingerprint,
      publicKey: key.spkiB64,
      token: 'TOKEN-123'
    });
    client.probeAxios.defaults.adapter = async (config) => {
      const requestUrl = new URL(config.url, config.baseURL).toString();
      if (config.url.endsWith('/machine')) {
        return {
          data: {
            name: 'Fake',
            serial,
            identity: {
              alg: 'ES256',
              public_key: key.spkiB64,
              fingerprint: key.fingerprint
            }
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          request: { responseURL: requestUrl }
        };
      }
      const body = JSON.parse(config.data || '{}');
      const message = api.buildIdentityMessage(
        serial,
        body.origin,
        new Uint8Array(Buffer.from(body.nonce, 'base64'))
      );
      return {
        data: {
          fingerprint: key.fingerprint,
          signature: await sign(key.kp.privateKey, message)
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        request: { responseURL: `${origin}/redirected-challenge` }
      };
    };

    await assert.rejects(
      client.getSettings(),
      (error) =>
        error instanceof api.MachineIdentityError && error.result === 'redirect'
    );
    pass++;
  }

  // 18) after a valid proof, a browser-followed redirect on the credentialed
  // request itself is still rejected by comparing XHR's effective URL.
  {
    const origin = 'http://127.0.0.1:1';
    const client = new Api({}, origin);
    client.setCredential({
      serial,
      fingerprint: key.fingerprint,
      publicKey: key.spkiB64,
      token: 'TOKEN-123'
    });
    client.probeAxios.defaults.adapter = async (config) => {
      const requestUrl = new URL(config.url, config.baseURL).toString();
      if (config.url.endsWith('/machine')) {
        return {
          data: {
            name: 'Fake',
            serial,
            identity: {
              alg: 'ES256',
              public_key: key.spkiB64,
              fingerprint: key.fingerprint
            }
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          request: { responseURL: requestUrl }
        };
      }
      const body = JSON.parse(config.data || '{}');
      const message = api.buildIdentityMessage(
        serial,
        body.origin,
        new Uint8Array(Buffer.from(body.nonce, 'base64'))
      );
      return {
        data: {
          fingerprint: key.fingerprint,
          signature: await sign(key.kp.privateKey, message)
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        request: { responseURL: requestUrl }
      };
    };
    client.axiosInstance.defaults.adapter = async (config) => ({
      data: {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: { responseURL: `${origin}/redirected-settings` }
    });

    await assert.rejects(
      client.getSettings(),
      (error) =>
        error instanceof api.MachineIdentityError && error.result === 'redirect'
    );
    pass++;
  }

  // 19) the Node adapter must not follow a 3xx returned by a credentialed
  // endpoint. The already-verified source sees its bearer, but the redirect
  // destination receives no request and therefore no credential.
  {
    const targetState = { requests: [], authorizations: [] };
    const target = http.createServer(async (req, res) => {
      await readBody(req);
      targetState.requests.push(req.url);
      if (req.headers.authorization) {
        targetState.authorizations.push(req.headers.authorization);
      }
      json(res, 200, {});
    });
    const targetPort = await listen(target);
    const source = makeServer({
      key,
      serial,
      mode: 'real',
      credentialRedirectTarget: `http://127.0.0.1:${targetPort}/stolen`
    });
    const sourcePort = await listen(source.server);
    try {
      const client = new Api({}, `http://127.0.0.1:${sourcePort}`);
      await client.completePairing('pid', '123456');
      await assert.rejects(
        client.getSettings(),
        (error) =>
          error instanceof api.MachineIdentityError &&
          error.result === 'redirect'
      );
      assert.deepStrictEqual(source.state.sawAuthorization, [
        'Bearer TOKEN-123'
      ]);
      assert.deepStrictEqual(
        targetState.requests,
        [],
        'credentialed redirect destination received no request'
      );
      assert.deepStrictEqual(targetState.authorizations, []);
    } finally {
      await close(source.server);
      await close(target);
    }
    pass++;
  }

  console.log(
    `ALL ${pass} client-rule checks PASS (happy/recovery/re-pair send only the current token; impostor / forged-fingerprint / wrong-serial / pinned-legacy / redirect / replay / credential race all withhold it; TTL forces a fresh proof)`
  );
})().catch((e) => {
  console.error('FAIL:', (e && e.stack) || e);
  process.exit(1);
});
