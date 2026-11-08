'use strict';

/**
 * Demo-/Testdaten für Entwicklung, Staging und Schulungsumgebung – ausschließlich
 * erfundene Daten. In Produktion ist das Seeding per Konfiguration verboten.
 * Alle Demo-Konten verwenden das Passwort aus SEED_DEMO_PASSWORD (Standard unten) und
 * müssen es beim ersten Login ändern, sofern nicht SEED_DEMO_NO_PWCHANGE gesetzt ist.
 */

const { randomUUID } = require('crypto');
const { hashPassword } = require('../lib/password');

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || 'Demo-Passwort-2026';

async function seedDemo(ctx) {
  if (ctx.config.production) throw new Error('Demo-Daten dürfen nicht in Produktion angelegt werden');
  const orgs = ctx.col('organizations');
  const users = ctx.col('users');
  if (await users.findOne({ email: 'admin@demo.prescriptcheck.test' })) return { skipped: true };

  const now = ctx.now();
  const mkOrg = (type, name, address) => orgs.insertOne({ _id: randomUUID(), type, name, address, status: 'ACTIVE', verifiedAt: now, verifiedBy: 'seed', createdAt: now });
  const practice = await mkOrg('PRACTICE', 'Demo-Praxis Dr. Muster (Testdaten)', { street: 'Musterstraße 1', zip: '80331', city: 'München', phone: '089 000000' });
  const pharmacy = await mkOrg('PHARMACY', 'Demo-Apotheke am Markt (Testdaten)', { street: 'Marktplatz 2', zip: '80331', city: 'München' });

  const passwordHash = await hashPassword(DEMO_PASSWORD, ctx.config.scryptN);
  const mustChange = !process.env.SEED_DEMO_NO_PWCHANGE;
  const mk = (email, name, role, orgId) =>
    users.insertOne({ _id: randomUUID(), email, name, role, orgId, status: 'ACTIVE', passwordHash, mustChangePassword: mustChange, mfaEnabled: false, failedLogins: 0, lockedUntil: 0, createdAt: now });
  await mk('admin@demo.prescriptcheck.test', 'Demo Plattform-Admin', 'PLATFORM_ADMIN', null);
  await mk('qs@demo.prescriptcheck.test', 'Demo QS-Supervisor', 'SUPERVISOR', null);
  await mk('auditor@demo.prescriptcheck.test', 'Demo Auditor', 'AUDITOR', null);
  await mk('praxisadmin@demo.prescriptcheck.test', 'Demo Praxis-Admin', 'PRACTICE_ADMIN', practice._id);
  await mk('arzt@demo.prescriptcheck.test', 'Dr. Erika Muster', 'PRESCRIBER', practice._id);
  await mk('mfa@demo.prescriptcheck.test', 'Demo Praxis-Mitarbeiter', 'PRACTICE_STAFF', practice._id);
  await mk('apothekeadmin@demo.prescriptcheck.test', 'Demo Apotheken-Admin', 'PHARMACY_ADMIN', pharmacy._id);
  await mk('apotheker@demo.prescriptcheck.test', 'Demo Apotheker', 'PHARMACIST', pharmacy._id);
  return { practiceId: practice._id, pharmacyId: pharmacy._id, password: DEMO_PASSWORD };
}

module.exports = { seedDemo, DEMO_PASSWORD };

if (require.main === module) {
  (async () => {
    require('dotenv').config();
    const { loadConfig } = require('../config');
    const { MongoStore } = require('../store/mongo');
    const { MemoryStore } = require('../store/memory');
    const { createContext } = require('../context');
    const config = loadConfig(process.env, { warn() {} });
    const store = config.storeType === 'mongo' ? new MongoStore(config.mongoUri) : new MemoryStore();
    if (store.connect) await store.connect();
    await store.init();
    const res = await seedDemo(createContext({ config, store }));
    process.stdout.write(`${JSON.stringify(res)}\n`);
    await store.close();
  })().catch((e) => {
    process.stderr.write(`${e.message}\n`);
    process.exit(1);
  });
}
