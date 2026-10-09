'use strict';

/**
 * Erzeugt Geheimnisse für die .env (JWT, Master-Key, Ed25519-Signaturschlüssel).
 * Ausgabe nur auf stdout – niemals committen. Zielbild: Schlüssel im Schlüsselspeicher (Vault/HSM).
 */
const crypto = require('crypto');

const { privateKey } = crypto.generateKeyPairSync('ed25519');
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });

process.stdout.write(
  [
    `JWT_SECRET=${crypto.randomBytes(48).toString('base64url')}`,
    `MASTER_KEY=${crypto.randomBytes(32).toString('base64')}`,
    'SIGNING_KEY_ID=1',
    `SIGNING_PRIVATE_KEY=${Buffer.from(pem).toString('base64')}`,
    '',
  ].join('\n')
);
