'use strict';

/**
 * Legt das erste Plattform-Admin-Konto an (z. B. bei der Erstinstallation).
 * Aufruf: ADMIN_EMAIL=... ADMIN_NAME="..." npm run admin:create
 * Das Initialpasswort wird einmalig ausgegeben; beim ersten Login ist ein Wechsel Pflicht.
 */
require('dotenv').config();
const { randomUUID } = require('crypto');
const { loadConfig } = require('../config');
const { MongoStore } = require('../store/mongo');
const { MemoryStore } = require('../store/memory');
const { createContext } = require('../context');
const { hashPassword, generatePassword } = require('../lib/password');
const v = require('../lib/validate');

(async () => {
  const config = loadConfig(process.env, { warn() {} });
  const email = v.email(process.env.ADMIN_EMAIL);
  const name = v.str(process.env.ADMIN_NAME || 'Plattform-Administrator', 'ADMIN_NAME');
  const store = config.storeType === 'mongo' ? new MongoStore(config.mongoUri) : new MemoryStore();
  if (store.connect) await store.connect();
  await store.init();
  const ctx = createContext({ config, store });
  const password = generatePassword();
  await ctx.col('users').insertOne({
    _id: randomUUID(), email, name, role: 'PLATFORM_ADMIN', orgId: null, status: 'ACTIVE',
    passwordHash: await hashPassword(password, config.scryptN), mustChangePassword: true, mfaEnabled: false, failedLogins: 0, lockedUntil: 0, createdAt: Date.now(),
  });
  await ctx.audit.record({ chains: ['platform'], actor: { role: 'SYSTEM' }, action: 'USER_CREATED', detail: { role: 'PLATFORM_ADMIN', via: 'cli' } });
  process.stdout.write(`Plattform-Admin angelegt: ${email}\nInitialpasswort (einmalig): ${password}\n`);
  await store.close();
})().catch((e) => {
  process.stderr.write(`${e.code === 'DUPLICATE' ? 'Nutzer existiert bereits' : e.message}\n`);
  process.exit(1);
});
