'use strict';

const crypto = require('crypto');

/** TOTP nach RFC 6238 (HMAC-SHA1, 6 Stellen, 30 s) – kompatibel mit gängigen Authenticator-Apps. */

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of str.replace(/=+$/, '').toUpperCase()) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error('Ungültiges Base32');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

const generateSecret = () => base32Encode(crypto.randomBytes(20));

function hotp(secretB32, counter) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', base32Decode(secretB32)).update(msg).digest();
  const off = h[h.length - 1] & 15;
  const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(bin % 1_000_000).padStart(6, '0');
}

const stepAt = (timeMs) => Math.floor(timeMs / 30000);

/**
 * Prüft einen Code im Fenster ±1 Schritt.
 * @returns {number|null} verwendeter Zeitschritt (für Replay-Schutz) oder null
 */
function verifyTotp(secretB32, code, timeMs = Date.now()) {
  if (!/^\d{6}$/.test(String(code || ''))) return null;
  const now = stepAt(timeMs);
  for (const delta of [0, -1, 1]) {
    const step = now + delta;
    const expected = hotp(secretB32, step);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(code)))) return step;
  }
  return null;
}

const otpauthUrl = (secretB32, account, issuer = 'PrescriptCheck') =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

module.exports = { generateSecret, verifyTotp, hotp, stepAt, otpauthUrl, base32Encode, base32Decode };
