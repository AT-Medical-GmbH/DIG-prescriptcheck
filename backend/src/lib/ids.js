'use strict';

const crypto = require('crypto');

/**
 * Seriennummern: PC-YY-XXXX-XXXX-C
 *  - YY   Jahr der Ausstellung (UTC, zweistellig)
 *  - X    8 Zeichen Crockford-Base32 (40 Bit Zufall, nicht aufzählbar)
 *  - C    Prüfzeichen (Luhn mod 32) – erkennt Tippfehler, ist KEIN Fälschungsschutz
 * Der Fälschungsschutz liegt ausschließlich in der digitalen Signatur (rxCode.js).
 */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford: ohne I, L, O, U
const BASE = ALPHABET.length; // 32

function encodeBase32(bytes5) {
  if (!Buffer.isBuffer(bytes5) || bytes5.length !== 5) throw new TypeError('5 Bytes erwartet');
  let bits = 0n;
  for (const b of bytes5) bits = (bits << 8n) | BigInt(b);
  let out = '';
  for (let i = 7; i >= 0; i--) out += ALPHABET[Number((bits >> BigInt(i * 5)) & 31n)];
  return out;
}

function decodeBase32(str8) {
  if (typeof str8 !== 'string' || str8.length !== 8) return null;
  let bits = 0n;
  for (const ch of str8) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) return null;
    bits = (bits << 5n) | BigInt(idx);
  }
  const out = Buffer.alloc(5);
  for (let i = 4; i >= 0; i--) {
    out[i] = Number(bits & 255n);
    bits >>= 8n;
  }
  return out;
}

function checkChar(str) {
  let factor = 2;
  let sum = 0;
  for (let i = str.length - 1; i >= 0; i--) {
    const cp = ALPHABET.indexOf(str[i]);
    if (cp < 0) return null;
    let addend = factor * cp;
    factor = factor === 2 ? 1 : 2;
    addend = Math.floor(addend / BASE) + (addend % BASE);
    sum += addend;
  }
  return ALPHABET[(BASE - (sum % BASE)) % BASE];
}

function format(yy, body8) {
  const chk = checkChar(yy + body8);
  return `PC-${yy}-${body8.slice(0, 4)}-${body8.slice(4)}-${chk}`;
}

/** Seriennummer aus Ausstellungsjahr und 5 Zufallsbytes bilden. */
function serialFromParts(year, bytes5) {
  const yy = String(year % 100).padStart(2, '0');
  return format(yy, encodeBase32(bytes5));
}

function generateSerial(nowMs = Date.now()) {
  const raw = crypto.randomBytes(5);
  const year = new Date(nowMs).getUTCFullYear();
  return { serial: serialFromParts(year, raw), raw };
}

/**
 * Eingabe tolerant normalisieren (Groß-/Kleinschreibung, Leerzeichen, Bindestriche,
 * O→0, I/L→1) und Prüfzeichen kontrollieren. Gibt null zurück, wenn ungültig.
 */
function parseSerial(input) {
  if (typeof input !== 'string') return null;
  const s = input.toUpperCase().replace(/[\s-]+/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  const m = /^PC(\d{2})([0-9A-Z]{8})([0-9A-Z])$/.exec(s);
  if (!m) return null;
  const [, yy, body, chk] = m;
  if (checkChar(yy + body) !== chk) return null;
  return { serial: format(yy, body), yy, raw: decodeBase32(body) };
}

module.exports = { generateSerial, serialFromParts, parseSerial, encodeBase32, decodeBase32, checkChar };
