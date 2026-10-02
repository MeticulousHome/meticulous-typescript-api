const assert = require('node:assert');
const { readFileSync } = require('node:fs');
const id = require('../dist/index.js');

(async () => {
  const VEC = JSON.parse(readFileSync(process.argv[2] || require("node:path").join(__dirname, "vectors", "identity_v1.json"), 'utf8'));
  const b64 = s => new Uint8Array(Buffer.from(s, 'base64'));
  let pass = 0;

  // 1) message layout matches the backend
  const msg = id.buildIdentityMessage(VEC.serial, VEC.origin, b64(VEC.nonce));
  assert.strictEqual(Buffer.from(msg).toString('hex'), VEC.message_hex, 'message_hex');
  pass++;

  // 2) fingerprint matches
  assert.strictEqual(id.fingerprintOf(VEC.public_key), VEC.fingerprint, 'fingerprint');
  pass++;

  // 3) verify the backend vector via WebCrypto (subtle available in Node)
  assert.ok(globalThis.crypto && globalThis.crypto.subtle, 'subtle present in node');
  assert.strictEqual(await id.verifyIdentitySignature(VEC.public_key, msg, VEC.signature), true, 'webcrypto verify');
  pass++;

  // 4) verify via the NOBLE fallback: hide crypto.subtle to force it
  const realSubtle = globalThis.crypto.subtle;
  Object.defineProperty(globalThis.crypto, 'subtle', { value: undefined, configurable: true });
  try {
    assert.strictEqual(await id.verifyIdentitySignature(VEC.public_key, msg, VEC.signature), true, 'noble verify (fallback)');
    pass++;
    // tampered message must fail on the noble path
    const bad = Uint8Array.from(msg); bad[bad.length - 1] ^= 1;
    assert.strictEqual(await id.verifyIdentitySignature(VEC.public_key, bad, VEC.signature), false, 'noble rejects tampered');
    pass++;
  } finally {
    Object.defineProperty(globalThis.crypto, 'subtle', { value: realSubtle, configurable: true });
  }

  // 5) canonicalOrigin KATs identical to the backend
  const kats = {
    'http://10.10.0.42': 'http://10.10.0.42',
    'http://10.10.0.42:80': 'http://10.10.0.42',
    'http://10.10.0.42:8080': 'http://10.10.0.42:8080',
    'https://10.10.0.42:443': 'https://10.10.0.42',
    'HTTP://10.10.0.42': 'http://10.10.0.42',
    'http://Espresso.Local': 'http://espresso.local',
    'http://espresso.local.': 'http://espresso.local',
    'http://[2001:DB8::1]:8080': 'http://[2001:db8::1]:8080',
    'http://[2001:db8:0:0:0:0:0:1]': 'http://[2001:db8::1]',
  };
  for (const [raw, exp] of Object.entries(kats)) {
    assert.strictEqual(id.canonicalOrigin(raw), exp, `KAT ${raw}`);
  }
  pass++;

  // 6) canonicalOrigin rejects bad origins
  for (const bad of ['ftp://10.10.0.42', 'http://u:p@10.10.0.42', 'http://10.10.0.42/x', 'http://10.10.0.42?q=1']) {
    assert.throws(() => id.canonicalOrigin(bad), `reject ${bad}`);
  }
  pass++;

  console.log(`ALL ${pass} identity client checks PASS (message layout, fingerprint, WebCrypto+noble verify, tamper-reject, canonicalOrigin KATs+rejections) against the backend vector`);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
