'use strict';

const crypto = require('crypto');
const fixtures = require('./qr.fixtures.json');
const { encodeQr, numDataCodewords, MAX_VERSION } = require('./qr');
const { Keyring } = require('./signing');
const { encodeCode } = require('./rxCode');
const { generateSerial } = require('./ids');

const bitsOf = (r) => r.modules.map((row) => row.map((b) => (b ? '1' : '0')).join('')).join('');

describe('QR-Encoder', () => {
  // Die Fixtures stammen aus einem unabhängigen Referenz-Encoder (reportlab, Python)
  // und decken Versionen, Masken sowie minimale/maximale Nutzlast ab.
  test.each(fixtures.cases.map((c) => [c.ver, c.mask, c.payload.length / 2, c]))(
    'Version %i, Maske %i, %i Bytes stimmt bitgenau mit der Referenz überein',
    (_v, _m, _n, c) => {
      const r = encodeQr(Buffer.from(c.payload, 'hex'), { mask: c.mask, minVersion: c.ver });
      expect(r.version).toBe(c.ver);
      expect(crypto.createHash('sha256').update(bitsOf(r)).digest('hex')).toBe(c.sha256);
    }
  );

  test('wählt die kleinste passende Version und eine gültige Maske', () => {
    const r = encodeQr('PrescriptCheck');
    expect(r.version).toBe(1);
    expect(r.size).toBe(21);
    const cap = Math.floor((numDataCodewords(5) * 8 - 12) / 8);
    expect(encodeQr(Buffer.alloc(cap, 1)).version).toBe(5);
    expect(encodeQr(Buffer.alloc(cap + 1, 1)).version).toBe(6);
  });

  test('zu lange Daten werden abgelehnt', () => {
    expect(() => encodeQr(Buffer.alloc(2000))).toThrow(/zu lang/);
    expect(MAX_VERSION).toBe(15);
  });

  test('echter Rezeptcode (131 Zeichen) ergibt QR Version 8', () => {
    const ring = Keyring.generate(1);
    const { raw } = generateSerial();
    const iat = Math.floor(Date.now() / 1000);
    const code = encodeCode({ kid: 1, iatSec: iat, expSec: iat + 1000, serialRaw: raw, hashHex: 'ab'.repeat(32) }, ring);
    const r = encodeQr(code);
    expect(r.version).toBe(8);
    expect(r.size).toBe(49);
  });
});
