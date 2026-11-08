'use strict';

const crypto = require('crypto');
const fs = require('fs');
const { Keyring } = require('../lib/signing');

const bool = (v, def) => (v === undefined || v === '' ? def : ['1', 'true', 'yes'].includes(String(v).toLowerCase()));

function parsePrivateKey(raw) {
  const pem = raw.includes('BEGIN') ? raw.replace(/\\n/g, '\n') : Buffer.from(raw, 'base64').toString('utf8');
  return crypto.createPrivateKey(pem);
}

const FILE_SECRETS = ['JWT_SECRET', 'MASTER_KEY', 'SIGNING_PRIVATE_KEY', 'SIGNING_PUBLIC_KEYS_JSON', 'MONGODB_URI'];

/** Geheimnisse dürfen statt per Umgebungsvariable als Datei (Docker/Kubernetes Secrets, NAME_FILE) übergeben werden. */
function withFileSecrets(env, problems) {
  const out = { ...env };
  for (const name of FILE_SECRETS) {
    const file = env[`${name}_FILE`];
    if (!file) continue;
    if (env[name]) problems.push(`${name} und ${name}_FILE sind gleichzeitig gesetzt`);
    try {
      out[name] = fs.readFileSync(file, 'utf8').trim();
    } catch (e) {
      problems.push(`${name}_FILE nicht lesbar (${e.code || 'Fehler'})`);
    }
  }
  return out;
}

/** TRUST_PROXY: Zahl (Anzahl Proxys), true/false oder Liste vertrauenswürdiger Adressen/Subnetze. */
function parseTrustProxy(raw) {
  if (raw === undefined || raw === '') return false;
  if (/^\d+$/.test(raw)) return Number(raw) || false;
  if (['true', 'yes'].includes(raw.toLowerCase())) return true;
  if (['false', 'no'].includes(raw.toLowerCase())) return false;
  return raw;
}

/**
 * Lädt und validiert die Konfiguration. In Produktion sind Geheimnisse Pflicht
 * und werden nie automatisch erzeugt; außerhalb von Produktion werden fehlende
 * Geheimnisse flüchtig erzeugt (Daten/Tokens überleben dann keinen Neustart).
 */
function loadConfig(rawEnv = process.env, log = { warn() {} }) {
  const problems = [];
  const env = withFileSecrets(rawEnv, problems);
  const nodeEnv = env.NODE_ENV || 'development';
  const production = nodeEnv === 'production';
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

  // Hinter einem Reverse-Proxy sehen Rate-Limits und Audit-Log sonst nur die Proxy-IP statt der Client-IP.
  // Deshalb in Produktion bewusst setzen (Anzahl Proxys, z. B. 1; "0" = kein Proxy).
  if (production && (env.TRUST_PROXY === undefined || env.TRUST_PROXY === '')) {
    problems.push('TRUST_PROXY muss in Produktion gesetzt sein (Anzahl vorgeschalteter Proxys, z. B. 1; 0 = kein Proxy)');
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
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
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
