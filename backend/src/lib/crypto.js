'use strict';

const crypto = require('crypto');

const b64u = (buf) => Buffer.from(buf).toString('base64url');

/** Kanonisches JSON (Schlüssel sortiert) – Grundlage für Hashes und Audit-HMACs. */
function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
}

const sha256Hex = (data) => crypto.createHash('sha256').update(data).digest('hex');
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * Vault: abgeleitete Schlüssel aus einem Master-Key (Entwicklung/Pilot).
 * Zielbild (Konzept 9.4): Schlüssel im Schlüsselspeicher (Vault/OpenBao/HSM).
 *  - Feldverschlüsselung AES-256-GCM, Schlüssel je Mandant (HKDF), Mandant als AAD
 *  - Geburtsdatum-Abgleich per HMAC, gebunden an die Seriennummer
 *  - Audit-Integrität per HMAC
 */
function createVault(masterKey) {
  if (!Buffer.isBuffer(masterKey) || masterKey.length !== 32) {
    throw new Error('MASTER_KEY muss 32 Bytes lang sein');
  }
  const derive = (info) => Buffer.from(crypto.hkdfSync('sha256', masterKey, Buffer.alloc(0), info, 32));
  const dobKey = derive('prescriptcheck/dob-mac/v1');
  const auditKey = derive('prescriptcheck/audit/v1');
  const orgKeys = new Map();

  const orgKey = (orgId) => {
    if (!orgKeys.has(orgId)) orgKeys.set(orgId, derive(`prescriptcheck/field/v1/${orgId}`));
    return orgKeys.get(orgId);
  };

  function encrypt(orgId, plaintext) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', orgKey(orgId), iv);
    cipher.setAAD(Buffer.from(orgId));
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return `v1.${b64u(Buffer.concat([iv, cipher.getAuthTag(), ct]))}`;
  }

  function decrypt(orgId, token) {
    if (typeof token !== 'string' || !token.startsWith('v1.')) throw new Error('Unbekanntes Verschlüsselungsformat');
    const buf = Buffer.from(token.slice(3), 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', orgKey(orgId), buf.subarray(0, 12));
    decipher.setAAD(Buffer.from(orgId));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
  }

  return {
    encrypt,
    decrypt,
    encryptJson: (orgId, obj) => encrypt(orgId, JSON.stringify(obj)),
    decryptJson: (orgId, token) => JSON.parse(decrypt(orgId, token)),
    dobMac: (serial, dob) => crypto.createHmac('sha256', dobKey).update(`${serial}|${dob}`).digest('hex'),
    auditHmac: (data) => crypto.createHmac('sha256', auditKey).update(data).digest('hex'),
  };
}

module.exports = { createVault, canonicalJson, sha256Hex, randomToken, safeEqual, b64u };
