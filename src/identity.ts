// Machine identity pinning (phase 1), the client half of
// DESIGN-MACHINE-IDENTITY-P256.md. This is "the client rule, stated once":
// before any stored credential (bearer, Socket.IO auth) is sent to an origin,
// that origin must have just signed a fresh nonce under the public key pinned
// with the credential. A substitute server at a reused address cannot sign, so
// the credential is withheld.
//
// Pure, dependency-light, and runs in three places:
//   - Node (tests/CI) and secure browser contexts: WebCrypto (crypto.subtle)
//   - insecure browser contexts (http://<machine-ip>, where crypto.subtle is
//     undefined): @noble/curves p256.verify
// The verifier picks WebCrypto when available and falls back to noble.

import { p256 } from '@noble/curves/nist.js';
import { sha256 } from '@noble/hashes/sha2.js';

export const IDENTITY_ALG = 'ES256';
const DOMAIN = 'meticulous-machine-identity/v1';

export interface MachineIdentity {
  alg: string;
  public_key: string; // SPKI DER, base64
  fingerprint: string; // sha256(SPKI DER), lowercase hex
}

export interface PinnedCredential {
  serial: string;
  fingerprint: string;
  publicKey: string; // SPKI DER, base64
  token: string;
  lastOrigin?: string;
  state?: 'ok' | 'identity_changed';
}

export type VerifyResult =
  | 'ok'
  | 'no_identity'
  | 'mismatch'
  | 'unreachable'
  | 'redirect';

// --- byte helpers ------------------------------------------------------------

function b64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined')
    return new Uint8Array(Buffer.from(b64, 'base64'));
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToHex(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += x.toString(16).padStart(2, '0');
  return s;
}

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function lp(b: Uint8Array): Uint8Array {
  if (b.length >= 65536) throw new Error('length-prefixed field too long');
  const out = new Uint8Array(b.length + 2);
  out[0] = (b.length >> 8) & 0xff;
  out[1] = b.length & 0xff;
  out.set(b, 2);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

// --- the cross-language contract (must match identity.py byte-for-byte) -------

export function buildIdentityMessage(
  serial: string,
  origin: string,
  nonce: Uint8Array
): Uint8Array {
  return concat(
    lp(utf8(DOMAIN)),
    lp(utf8(serial)),
    lp(utf8(origin)),
    lp(nonce)
  );
}

export function fingerprintOf(spkiB64: string): string {
  return bytesToHex(sha256(b64ToBytes(spkiB64)));
}

export class OriginError extends Error {}

// Byte-exact origin canonicalization, matching identity.canonical_origin.
export function canonicalOrigin(input: string): string {
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    throw new OriginError('unparsable origin');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new OriginError('unsupported scheme');
  }
  if (u.username || u.password)
    throw new OriginError('origin must not contain userinfo');
  if ((u.pathname && u.pathname !== '/') || u.search || u.hash) {
    throw new OriginError('origin must not contain path, query or fragment');
  }
  const scheme = u.protocol.slice(0, -1);
  // u.hostname is already lowercased; for IPv6 it is bracketed and compressed.
  let host = u.hostname.toLowerCase();
  if (host.includes('%'))
    throw new OriginError('IPv6 zone-ids are not allowed');
  if (!host.startsWith('[')) host = host.replace(/\.$/, ''); // trailing-dot FQDN
  if (!host || host === '[]') throw new OriginError('origin has no host');
  const def = scheme === 'http' ? '80' : '443';
  const port = u.port && u.port !== def ? `:${u.port}` : '';
  return `${scheme}://${host}${port}`;
}

// --- signature verification --------------------------------------------------

// Extract the uncompressed EC point from a P-256 SPKI DER. For a named-curve
// P-256 key the SPKI is 91 bytes and the 65-byte point (0x04||X||Y) is its
// tail; used only on the noble fallback path (no WebCrypto to parse SPKI).
function spkiToRawPoint(spkiDer: Uint8Array): Uint8Array {
  if (spkiDer.length !== 91 || spkiDer[26] !== 0x04) {
    throw new Error('not a P-256 SPKI');
  }
  return spkiDer.slice(26);
}

function hasSubtle(): boolean {
  return typeof globalThis.crypto !== 'undefined' && !!globalThis.crypto.subtle;
}

// Verify an ES256 signature (P1363 r||s, base64) over `message` under the SPKI
// public key. Returns false on any failure (never throws for a bad signature).
export async function verifyIdentitySignature(
  spkiB64: string,
  message: Uint8Array,
  signatureB64: string
): Promise<boolean> {
  const sig = b64ToBytes(signatureB64);
  if (sig.length !== 64) return false;
  const spki = b64ToBytes(spkiB64);
  try {
    if (hasSubtle()) {
      const key = await globalThis.crypto.subtle.importKey(
        'spki',
        spki,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify']
      );
      return await globalThis.crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        key,
        sig,
        message
      );
    }
    // Insecure-context browser: verify with noble. `prehash: true` makes noble
    // SHA-256 the message internally, matching WebCrypto and the backend. noble
    // rejects high-S by default, which is why the backend normalizes to low-S.
    return p256.verify(sig, message, spkiToRawPoint(spki), { prehash: true });
  } catch {
    return false;
  }
}

export function randomNonce(): Uint8Array {
  const n = new Uint8Array(32);
  globalThis.crypto.getRandomValues(n);
  return n;
}
