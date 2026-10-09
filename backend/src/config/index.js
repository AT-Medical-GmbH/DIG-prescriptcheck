'use strict';

const crypto = require('crypto');
const { Keyring } = require('../lib/signing');

const bool = (v, def) => (v === undefined || v === '' ? def : ['1', 'true', 'yes'].includes(String(v).toLowerCase()));

function parsePrivateKey(raw) {
  const pem = raw.includes('BEGIN') ? raw.replace(/\\n/g, '\n') : Buffer.from(raw, 'base64').toString('utf8');
  return crypto.createPrivateKey(pem);
}

/**
 * Lädt und validiert die Konfiguration. In Produktion sind Geheimnisse Pflicht
 * und werden nie automatisch erzeugt; außerhalb von Produktion werden fehlende
 * Geheimnisse flüchtig erzeugt (Daten/Tokens überleben dann keinen Neustart).
 */
function loadConfig(env = process.env, log = { warn() {} }) {
  const nodeEnv = env.NODE_ENV || 'development';
  const production = nodeEnv === 'production';
  const problems = [];
  const ephemeral = [];

  const need = (name) => {
    if (production) problems.push(`${name} muss in Produktion gesetzt sein`);
    else ephemeral.push(name);
  };

  let jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    need('JWT_SECRET');
    jwtSecret = crypto.randomBytes(48).toString('base64url');
  } else if (jwtSecret.length < 32) problems.push('JWT_SECRET muss mindestens 32 Zeichen lang sein');

  let masterKey;
  if (env.MASTER_KEY) {
    masterKey = Buffer.from(env.MASTER_KEY, 'base64');
    if (masterKey.length !== 32) problems.push('MASTER_KEY muss base64-kodierte 32 Bytes sein');
  } else {
    need('MASTER_KEY');
    masterKey = crypto.randomBytes(32);
  }

  let keyring;
  const kid = Number(env.SIGNING_KEY_ID || 1);
  if (env.SIGNING_PRIVATE_KEY) {
    try {
      const extra = env.SIGNING_PUBLIC_KEYS_JSON ? JSON.parse(env.SIGNING_PUBLIC_KEYS_JSON) : {};
      keyring = new Keyring({ currentKid: kid, privateKey: parsePrivateKey(env.SIGNING_PRIVATE_KEY), publicKeys: extra });
    } catch (e) {
      problems.push(`SIGNING_PRIVATE_KEY/SIGNING_KEY_ID ungültig: ${e.message}`);
    }
  } else {
    need('SIGNING_PRIVATE_KEY');
    keyring = Keyring.generate(kid);
  }

  const storeType = env.STORE || (env.MONGODB_URI ? 'mongo' : 'memory');
  if (!['memory', 'mongo'].includes(storeType)) problems.push('STORE muss memory oder mongo sein');
  if (storeType === 'mongo' && !env.MONGODB_URI) problems.push('MONGODB_URI fehlt');
  if (production && storeType === 'memory' && !bool(env.ALLOW_MEMORY_STORE, false)) {
    problems.push('In Produktion ist der Speicher-Store nicht zulässig (STORE=mongo)');
  }

  const demo = bool(env.SEED_DEMO, false);
  if (production && demo) problems.push('SEED_DEMO ist in Produktion verboten');

  if (problems.length) {
    const err = new Error(`Ungültige Konfiguration:\n - ${problems.join('\n - ')}`);
    err.code = 'CONFIG_INVALID';
    throw err;
  }
  if (ephemeral.length) log.warn('Flüchtige Entwicklungsgeheimnisse erzeugt', { names: ephemeral });

  return {
    nodeEnv,
    production,
    port: Number(env.PORT || 3000),
    storeType,
    mongoUri: env.MONGODB_URI,
    jwtSecret,
    masterKey,
    keyring,
    requireMfa: bool(env.REQUIRE_MFA, production),
    corsOrigins: (env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
    trustProxy: env.TRUST_PROXY ? Number(env.TRUST_PROXY) || env.TRUST_PROXY : false,
    // OFFEN (Konzept 6.1): gesetzliche/berufsrechtliche Gültigkeitsdauer von Privatrezepten klären.
    rxValidityDays: Number(env.RX_VALIDITY_DAYS || 28),
    scryptN: Number(env.PASSWORD_SCRYPT_N || 32768),
    rateLimitEnabled: bool(env.RATE_LIMIT, nodeEnv !== 'test'),
    publicUrl: env.PUBLIC_URL || '',
    seedDemo: demo,
    accessTokenTtlSec: 15 * 60,
    sessionTtlSec: 8 * 60 * 60,
    logLevel: env.LOG_LEVEL || (nodeEnv === 'test' ? 'silent' : 'info'),
  };
}

module.exports = { loadConfig };
