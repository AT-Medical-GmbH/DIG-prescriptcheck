'use strict';

const { parseSerial, serialFromParts } = require('./ids');

/**
 * Rezeptcode (QR). Kompakt-binär, signiert, ohne Patientendaten:
 *
 *   Byte  0       Version (=1)
 *   Byte  1       Schlüssel-ID (kid)
 *   Byte  2..5    Ausstellung (iat, Unix-Sekunden, big endian)
 *   Byte  6..9    Gültig bis (exp, Unix-Sekunden, big endian)
 *   Byte 10..14   Seriennummer (5 Bytes Zufallsanteil; Jahr ergibt sich aus iat)
 *   Byte 15..30   Inhalts-Hash (erste 16 Bytes SHA-256 über die kanonische Verordnung + Salt)
 *   Byte 31..94   Ed25519-Signatur über Byte 0..30
 *
 * String: "PC1:" + base64url(95 Bytes)  → 131 Zeichen, passt in QR Version 8 (Stufe M).
 */

const PREFIX = 'PC1:';
const HEADER_LEN = 31;
const TOTAL_LEN = HEADER_LEN + 64;

function buildHeader({ kid, iatSec, expSec, serialRaw, hashHex }) {
  const h = Buffer.alloc(HEADER_LEN);
  h[0] = 1;
  h[1] = kid;
  h.writeUInt32BE(iatSec, 2);
  h.writeUInt32BE(expSec, 6);
  serialRaw.copy(h, 10);
  Buffer.from(hashHex.slice(0, 32), 'hex').copy(h, 15);
  return h;
}

function encodeCode({ kid, iatSec, expSec, serialRaw, hashHex }, keyring) {
  if (kid !== keyring.currentKid) throw new Error('Nur mit dem aktuellen Schlüssel signieren');
  const header = buildHeader({ kid, iatSec, expSec, serialRaw, hashHex });
  const sig = keyring.sign(header);
  return PREFIX + Buffer.concat([header, sig]).toString('base64url');
}

/**
 * @returns {{ok:false, reason:string} | {ok:true, kid:number, iatSec:number, expSec:number, serial:string, hashPrefix:string}}
 */
function decodeCode(code, keyring) {
  if (typeof code !== 'string') return { ok: false, reason: 'FORMAT' };
  const trimmed = code.trim();
  if (!trimmed.startsWith(PREFIX)) return { ok: false, reason: 'FORMAT' };
  const body = trimmed.slice(PREFIX.length);
  if (!/^[A-Za-z0-9_-]+$/.test(body)) return { ok: false, reason: 'FORMAT' };
  const buf = Buffer.from(body, 'base64url');
  if (buf.length !== TOTAL_LEN || buf[0] !== 1) return { ok: false, reason: 'FORMAT' };
  const header = buf.subarray(0, HEADER_LEN);
  const sig = buf.subarray(HEADER_LEN);
  const kid = header[1];
  if (!keyring.verify(kid, header, sig)) return { ok: false, reason: 'SIGNATURE' };
  const iatSec = header.readUInt32BE(2);
  const expSec = header.readUInt32BE(6);
  const year = new Date(iatSec * 1000).getUTCFullYear();
  const serial = serialFromParts(year, Buffer.from(header.subarray(10, 15)));
  if (!parseSerial(serial)) return { ok: false, reason: 'FORMAT' };
  return { ok: true, kid, iatSec, expSec, serial, hashPrefix: header.subarray(15, 31).toString('hex') };
}

module.exports = { encodeCode, decodeCode, PREFIX };
