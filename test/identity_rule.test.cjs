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
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', kp.publicKey));
  return { kp, spkiB64: b64(spki), fingerprint: api.fingerprintOf(b64(spki)) };
}

async function sign(privKey, message) {
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privKey, message)
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

// mode: 'real' | 'noident' | 'redirect' | 'forged-fp'
function makeServer(opts) {
  const { key, serial, mode, signKey } = opts;
  const state = { sawAuthOn: [] };
  const server = http.createServer(async (req, res) => {
    const body = await readBody(req);
    const url = req.url.split('?')[0];
    if (mode === 'redirect') {
      res.writeHead(302, { Location: 'http://evil.example/' });
      res.end();
      return;
    }
    if (url === '/api/v1/machine') {
      const out = { name: 'Fake', serial };
      if (mode !== 'noident') {
        out.identity = { alg: 'ES256', public_key: key.spkiB64, fingerprint: key.fingerprint };
      }
      return json(res, 200, out);
    }
    if (url === '/api/v1/identity/challenge') {
      if (mode === 'noident') return json(res, 404, { error: 'no identity' });
      const { nonce, origin } = JSON.parse(body || '{}');
      const msg = api.buildIdentityMessage(serial, origin, new Uint8Array(Buffer.from(nonce, 'base64')));
      const signature = await sign((signKey || key).kp.privateKey, msg);
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
    if (url === '/api/v1/pair/verify') {
      const out = { status: 'approved', token: 'TOKEN-123', device_id: 'd1', serial };
      if (mode !== 'noident') {
        out.identity = { alg: 'ES256', public_key: key.spkiB64, fingerprint: key.fingerprint };
      }
      return json(res, 200, out);
    }
    if (url.startsWith('/api/v1/settings')) {
      if (req.headers['authorization']) {
        state.sawAuthOn.push('settings');
        return json(res, 200, {});
      }
      return json(res, 401, { error: 'Unauthorized' });
    }
    json(res, 404, { error: 'nope' });
  });
  return { server, state };
}

function listen(server) {
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server.address().port)));
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
    assert.deepStrictEqual(state.sawAuthOn, ['settings'], 'token sent to the real machine');
    server.close();
    pass++;
  }

  // 2) impostor with a DIFFERENT key at the same origin: token withheld
  {
    const other = await genKey();
    const { server, state } = makeServer({ key: other, serial, mode: 'real' });
    const port = await listen(server);
    const client = new Api({}, `http://127.0.0.1:${port}`);
    client.setCredential({ serial, fingerprint: key.fingerprint, publicKey: key.spkiB64, token: 'TOKEN-123' });
    let threw = null;
    try {
      await client.getSettings();
    } catch (e) {
      threw = e;
    }
    assert.ok(threw instanceof api.MachineIdentityError, 'impostor request throws');
    assert.strictEqual(threw.result, 'mismatch');
    assert.deepStrictEqual(state.sawAuthOn, [], 'NO Authorization ever reached the impostor');
    server.close();
    pass++;
  }

  // 3) impostor that COPIES the fingerprint but cannot sign: still withheld
  {
    const other = await genKey();
    // /machine serves the REAL fingerprint+public_key, but challenges are signed
    // with `other` -> the client verifies with the pinned key and rejects.
    const { server, state } = makeServer({ key, serial, mode: 'forged-fp', signKey: other });
    const port = await listen(server);
    const client = new Api({}, `http://127.0.0.1:${port}`);
    client.setCredential({ serial, fingerprint: key.fingerprint, publicKey: key.spkiB64, token: 'T' });
    let threw = null;
    try {
      await client.getSettings();
    } catch (e) {
      threw = e;
    }
    assert.ok(threw instanceof api.MachineIdentityError && threw.result === 'mismatch', 'forged fp, bad signature -> mismatch');
    assert.deepStrictEqual(state.sawAuthOn, [], 'no token to the forged-fp impostor');
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
    assert.ok(threw instanceof api.MachineIdentityError && threw.result === 'no_identity', 'no-identity backend not pinned');
    server.close();
    pass++;
  }

  // 5) redirect on the probe: treated as failure, token withheld
  {
    const { server, state } = makeServer({ key, serial, mode: 'redirect' });
    const port = await listen(server);
    const client = new Api({}, `http://127.0.0.1:${port}`);
    client.setCredential({ serial, fingerprint: key.fingerprint, publicKey: key.spkiB64, token: 'T' });
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

  console.log(`ALL ${pass} client-rule checks PASS (happy path sends token; impostor / forged-fingerprint / no-identity / redirect all withhold it)`);
})().catch((e) => {
  console.error('FAIL:', (e && e.stack) || e);
  process.exit(1);
});
