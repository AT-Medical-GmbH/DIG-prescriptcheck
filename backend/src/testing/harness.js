'use strict';

/**
 * Test-Harness: App mit Speicher-Store, steuerbarer Uhr und Hilfsfunktionen.
 * Nur für Tests – wird nicht von der Anwendung geladen.
 */
const request = require('supertest');
const { randomUUID } = require('crypto');
const { loadConfig } = require('../config');
const { MemoryStore } = require('../store/memory');
const { createContext } = require('../context');
const { createApp } = require('../app');
const { hashPassword } = require('../lib/password');

const PASSWORD = 'Test-Passwort-2026';

async function createHarness(envOverrides = {}) {
  const config = loadConfig({ NODE_ENV: 'test', PASSWORD_SCRYPT_N: '1024', RATE_LIMIT: 'false', REQUIRE_MFA: 'false', ...envOverrides }, { warn() {} });
  const store = new MemoryStore();
  await store.init();
  const clock = { t: Date.UTC(2026, 9, 9, 10, 0, 0), now() { return this.t; }, advance(ms) { this.t += ms; } };
  const ctx = createContext({ config, store, now: () => clock.now() });
  const app = createApp(ctx);
  const passwordHash = await hashPassword(PASSWORD, config.scryptN);

  async function addOrg(type, name) {
    return ctx.col('organizations').insertOne({ _id: randomUUID(), type, name, address: { city: 'Teststadt' }, status: 'ACTIVE', verifiedAt: clock.now(), verifiedBy: 'test', createdAt: clock.now() });
  }
  async function addUser(email, role, orgId = null, extra = {}) {
    return ctx.col('users').insertOne({ _id: randomUUID(), email, name: `Test ${role}`, role, orgId, status: 'ACTIVE', passwordHash, mustChangePassword: false, mfaEnabled: false, failedLogins: 0, lockedUntil: 0, createdAt: clock.now(), ...extra });
  }
  async function login(email, password = PASSWORD, totp) {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password, totp });
    return res;
  }
  /** Meldet an und liefert einen Client mit gesetztem Bearer-Token. */
  async function as(email) {
    const res = await login(email);
    if (res.status !== 200) throw new Error(`Login fehlgeschlagen für ${email}: ${res.status} ${JSON.stringify(res.body)}`);
    const auth = { Authorization: `Bearer ${res.body.accessToken}` };
    const c = (method) => (path) => request(app)[method](`/api/v1${path}`).set(auth);
    return { token: res.body.accessToken, refreshToken: res.body.refreshToken, user: res.body.user, get: c('get'), post: c('post'), put: c('put'), patch: c('patch') };
  }

  /** Standard-Szenario: eine Praxis, zwei Apotheken, alle Rollen. */
  async function scenario() {
    const practice = await addOrg('PRACTICE', 'Praxis Dr. Test');
    const practice2 = await addOrg('PRACTICE', 'Zweite Praxis');
    const pharmacy = await addOrg('PHARMACY', 'Test-Apotheke');
    const pharmacy2 = await addOrg('PHARMACY', 'Zweite Apotheke');
    const users = {
      admin: await addUser('admin@test.de', 'PLATFORM_ADMIN'),
      supervisor: await addUser('qs@test.de', 'SUPERVISOR'),
      auditor: await addUser('auditor@test.de', 'AUDITOR'),
      practiceAdmin: await addUser('praxisadmin@test.de', 'PRACTICE_ADMIN', practice._id),
      prescriber: await addUser('arzt@test.de', 'PRESCRIBER', practice._id),
      prescriber2: await addUser('arzt2@test.de', 'PRESCRIBER', practice._id),
      staff: await addUser('mfa@test.de', 'PRACTICE_STAFF', practice._id),
      otherPrescriber: await addUser('arzt-b@test.de', 'PRESCRIBER', practice2._id),
      pharmacyAdmin: await addUser('apothekeadmin@test.de', 'PHARMACY_ADMIN', pharmacy._id),
      pharmacist: await addUser('apotheker@test.de', 'PHARMACIST', pharmacy._id),
      pharmacist2: await addUser('apotheker2@test.de', 'PHARMACIST', pharmacy._id),
      otherPharmacist: await addUser('apotheker-b@test.de', 'PHARMACIST', pharmacy2._id),
    };
    return { practice, practice2, pharmacy, pharmacy2, users };
  }

  const draftBody = (over = {}) => ({
    patient: { name: 'Max Mustermann', dob: '1980-05-17' },
    items: [{ medication: 'Ibuprofen 400 mg', form: 'Filmtabletten', strength: '400 mg', quantity: 'N2 (50 Stück)', dosage: '3 x täglich 1 Tablette' }],
    note: 'Testrezept',
    ...over,
  });

  /** Entwurf anlegen und ausstellen. */
  async function issueRx(prescriberClient, body = draftBody()) {
    const draft = await prescriberClient.post('/prescriptions').send(body);
    if (draft.status !== 201) throw new Error(`Entwurf fehlgeschlagen: ${JSON.stringify(draft.body)}`);
    const issued = await prescriberClient.post(`/prescriptions/${draft.body.id}/issue`).send({});
    if (issued.status !== 200) throw new Error(`Ausstellen fehlgeschlagen: ${JSON.stringify(issued.body)}`);
    return issued.body;
  }

  return { app, ctx, config, store, clock, addOrg, addUser, login, as, scenario, draftBody, issueRx, PASSWORD, request: () => request(app) };
}

module.exports = { createHarness, PASSWORD };
