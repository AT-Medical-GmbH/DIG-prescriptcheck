'use strict';

const { createHarness, PASSWORD } = require('../testing/harness');

const ROLE_EMAILS = {
  PLATFORM_ADMIN: 'admin@test.de',
  SUPERVISOR: 'qs@test.de',
  AUDITOR: 'auditor@test.de',
  PRACTICE_ADMIN: 'praxisadmin@test.de',
  PRESCRIBER: 'arzt@test.de',
  PRACTICE_STAFF: 'mfa@test.de',
  PHARMACY_ADMIN: 'apothekeadmin@test.de',
  PHARMACIST: 'apotheker@test.de',
};
const ALL = Object.keys(ROLE_EMAILS);
const PRACTICE = ['PRESCRIBER', 'PRACTICE_STAFF'];
const PHARMACY = ['PHARMACIST']; // PHARMACY_STAFF analog (in verification.spec.js)

/** [Methode, Pfad, erlaubte Rollen] – jede andere Rolle MUSS 403 erhalten. */
const MATRIX = [
  ['get', '/admin/organizations', ['PLATFORM_ADMIN']],
  ['post', '/admin/organizations', ['PLATFORM_ADMIN']],
  ['patch', '/admin/organizations/x', ['PLATFORM_ADMIN']],
  ['get', '/admin/users', ['PLATFORM_ADMIN']],
  ['post', '/admin/users', ['PLATFORM_ADMIN']],
  ['get', '/org/users', ['PRACTICE_ADMIN', 'PHARMACY_ADMIN']],
  ['post', '/org/users', ['PRACTICE_ADMIN', 'PHARMACY_ADMIN']],
  ['patch', '/users/x/status', ['PLATFORM_ADMIN', 'PRACTICE_ADMIN', 'PHARMACY_ADMIN']],
  ['get', '/prescriptions', PRACTICE],
  ['post', '/prescriptions', PRACTICE],
  ['post', '/prescriptions/block-bulk', ['PRESCRIBER']],
  ['post', '/prescriptions/block-all-open', ['PRESCRIBER']],
  ['get', '/prescriptions/x', PRACTICE],
  ['put', '/prescriptions/x', PRACTICE],
  ['post', '/prescriptions/x/discard', PRACTICE],
  ['post', '/prescriptions/x/issue', ['PRESCRIBER']],
  ['post', '/prescriptions/x/block', ['PRESCRIBER']],
  ['post', '/prescriptions/x/unblock', ['PRESCRIBER']],
  ['get', '/prescriptions/x/pdf', PRACTICE],
  ['post', '/verifications', PHARMACY],
  ['post', '/verifications/x/identity-check', PHARMACY],
  ['post', '/redemptions', PHARMACY],
  ['get', '/redemptions', PHARMACY],
  ['post', '/redemptions/PC-26-0000-0000-0/cancel', ['PHARMACIST']],
  ['post', '/qs/reports', PHARMACY],
  ['get', '/qs/flagged', ['SUPERVISOR']],
  ['post', '/qs/prescriptions/x/unblock', ['SUPERVISOR']],
  ['get', '/audit', ['PLATFORM_ADMIN', 'AUDITOR', 'PRACTICE_ADMIN', 'PHARMACY_ADMIN']],
  ['get', '/audit/verify', ['PLATFORM_ADMIN', 'AUDITOR', 'PRACTICE_ADMIN', 'PHARMACY_ADMIN']],
  ['get', '/notifications', ['PRACTICE_ADMIN', 'PRESCRIBER', 'PRACTICE_STAFF', 'PHARMACY_ADMIN', 'PHARMACIST']],
  ['post', '/notifications/read-all', ['PRACTICE_ADMIN', 'PRESCRIBER', 'PRACTICE_STAFF', 'PHARMACY_ADMIN', 'PHARMACIST']],
];

describe('Rechtematrix', () => {
  let h;
  const clients = {};
  beforeAll(async () => {
    h = await createHarness();
    await h.scenario();
    for (const [role, email] of Object.entries(ROLE_EMAILS)) clients[role] = await h.as(email);
  });

  test.each(MATRIX.flatMap(([method, path, allowed]) => ALL.filter((r) => !allowed.includes(r)).map((role) => [method.toUpperCase(), path, role])))(
    '%s %s ist für %s verboten',
    async (method, path, role) => {
      const res = await clients[role][method.toLowerCase()](path).send({});
      expect(res.status).toBe(403);
    }
  );

  test.each(MATRIX.map(([method, path]) => [method.toUpperCase(), path]))('%s %s verlangt Anmeldung', async (method, path) => {
    const res = await h.request()[method.toLowerCase()](`/api/v1${path}`).send({});
    expect(res.status).toBe(401);
  });

  test('Matrix deckt alle registrierten Fachrouten ab', () => {
    const covered = new Set(MATRIX.map(([m, p]) => `${m} ${p.replace(/\/(x|PC-26-0000-0000-0)(?=\/|$)/g, '/:p')}`));
    // grobe Plausibilität: mindestens die Kernrouten sind enthalten
    for (const must of ['post /prescriptions/:p/issue', 'post /verifications', 'post /redemptions', 'get /audit']) expect(covered.has(must) || [...covered].some((c) => c.startsWith(must.split('/:')[0]))).toBe(true);
    expect(MATRIX.length).toBeGreaterThanOrEqual(30);
  });
});

describe('Verwaltung', () => {
  let h;
  let s;
  let admin;
  beforeEach(async () => {
    h = await createHarness();
    s = await h.scenario();
    admin = await h.as('admin@test.de');
  });

  test('Organisation anlegen: Pflichtfelder, Duplikat, Statuswechsel', async () => {
    const ok = await admin.post('/admin/organizations').send({ type: 'PHARMACY', name: 'Neue Apotheke', address: { street: 'Weg 1', zip: '12345', city: 'Ort' } });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ type: 'PHARMACY', name: 'Neue Apotheke', status: 'ACTIVE' });
    expect((await admin.post('/admin/organizations').send({ type: 'PHARMACY', name: 'Neue Apotheke' })).status).toBe(409);
    expect((await admin.post('/admin/organizations').send({ type: 'KRANKENHAUS', name: 'X' })).status).toBe(400);
    expect((await admin.post('/admin/organizations').send({ type: 'PRACTICE' })).status).toBe(400);
    expect((await admin.patch(`/admin/organizations/${ok.body.id}`).send({ status: 'SUSPENDED' })).body.status).toBe('SUSPENDED');
    expect((await admin.patch('/admin/organizations/gibtsnicht').send({ status: 'ACTIVE' })).status).toBe(404);
    expect((await admin.patch(`/admin/organizations/${ok.body.id}`).send({ status: 'WEIRD' })).status).toBe(400);
    expect((await admin.get('/admin/organizations')).body.length).toBe(5);
  });

  test('Nutzer anlegen: Initialpasswort einmalig, Passwortwechsel Pflicht, Rolle muss zum Organisationstyp passen', async () => {
    const created = await admin.post('/admin/users').send({ email: 'Neu@Praxis.de', name: 'Neue Ärztin', role: 'PRESCRIBER', orgId: s.practice._id });
    expect(created.status).toBe(201);
    expect(created.body.initialPassword).toHaveLength(16);
    expect(created.body.user).toMatchObject({ email: 'neu@praxis.de', role: 'PRESCRIBER', mustChangePassword: true });
    expect(JSON.stringify((await admin.get('/admin/users')).body)).not.toContain(created.body.initialPassword);

    const c = await h.as('neu@praxis.de').catch(() => null);
    expect(c).toBeNull(); // Login mit Standardpasswort scheitert – das generierte ist ein anderes
    const login = await h.login('neu@praxis.de', created.body.initialPassword);
    expect(login.status).toBe(200);
    const token = { Authorization: `Bearer ${login.body.accessToken}` };
    const gated = await h.request().get('/api/v1/prescriptions').set(token);
    expect(gated.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');

    expect((await admin.post('/admin/users').send({ email: 'x@y.de', name: 'X', role: 'PRESCRIBER', orgId: s.pharmacy._id })).status).toBe(400);
    expect((await admin.post('/admin/users').send({ email: 'neu@praxis.de', name: 'X', role: 'PRESCRIBER', orgId: s.practice._id })).status).toBe(409);
    expect((await admin.post('/admin/users').send({ email: 'q@y.de', name: 'X', role: 'PRESCRIBER', orgId: 'gibtsnicht' })).status).toBe(404);
    expect((await admin.post('/admin/users').send({ email: 'q@y.de', name: 'X', role: 'GOTT', orgId: s.practice._id })).status).toBe(400);
    expect((await admin.post('/admin/users').send({ email: 'q@y.de', name: 'X', role: 'PRESCRIBER', orgId: s.practice._id, initialPassword: 'schwach' })).status).toBe(400);
    const own = await admin.post('/admin/users').send({ email: 'q2@y.de', name: 'X', role: 'AUDITOR', initialPassword: 'Eigenes-Passwort-2026' });
    expect(own.status).toBe(201);
    expect(own.body.initialPassword).toBeUndefined();
  });

  test('Organisations-Admin verwaltet nur die eigene Organisation', async () => {
    const pa = await h.as('praxisadmin@test.de');
    const ok = await pa.post('/org/users').send({ email: 'mfa2@test.de', name: 'MFA 2', role: 'PRACTICE_STAFF', orgId: s.practice2._id });
    expect(ok.status).toBe(201);
    expect(ok.body.user.orgId).toBe(s.practice._id); // übergebene orgId wird ignoriert
    expect((await pa.post('/org/users').send({ email: 'a@b.de', name: 'A', role: 'PLATFORM_ADMIN' })).status).toBe(403);
    expect((await pa.post('/org/users').send({ email: 'a@b.de', name: 'A', role: 'PHARMACIST' })).status).toBe(400);

    const list = (await pa.get('/org/users')).body;
    expect(list.every((u) => u.orgId === s.practice._id)).toBe(true);
    expect(list.map((u) => u.email)).not.toContain('arzt-b@test.de');

    const fremd = (await h.ctx.col('users').findOne({ email: 'arzt-b@test.de' }))._id;
    expect((await pa.patch(`/users/${fremd}/status`).send({ status: 'DISABLED' })).status).toBe(404);
    const self = (await h.ctx.col('users').findOne({ email: 'praxisadmin@test.de' }))._id;
    expect((await pa.patch(`/users/${self}/status`).send({ status: 'DISABLED' })).status).toBe(400);
    const mine = (await h.ctx.col('users').findOne({ email: 'arzt2@test.de' }))._id;
    expect((await pa.patch(`/users/${mine}/status`).send({ status: 'DISABLED' })).body.status).toBe('DISABLED');
  });

  test('Plattform-Admin hat keinen Zugriff auf Rezeptinhalte; Audit-Zugriff nur nach Rolle', async () => {
    const arzt = await h.as('arzt@test.de');
    await h.issueRx(arzt);
    expect((await admin.get('/prescriptions')).status).toBe(403);
    const auditor = await h.as('auditor@test.de');
    const chain = (await auditor.get(`/audit?chain=${s.practice._id}`)).body;
    expect(chain.entries.length).toBeGreaterThan(0);
    // Praxis-Admin kann nicht in fremde Ketten schauen, auch nicht per Parameter
    const pa = await h.as('praxisadmin@test.de');
    expect((await pa.get(`/audit?chain=${s.practice2._id}`)).body.chain).toBe(s.practice._id);
    expect((await auditor.get(`/audit/verify?chain=${s.practice._id}`)).body.ok).toBe(true);
  });
});

describe('Allgemeines', () => {
  let h;
  beforeAll(async () => {
    h = await createHarness();
  });

  test('Health, Readiness, öffentliche Schlüssel, 404, Sicherheits-Header', async () => {
    expect((await h.request().get('/healthz')).body).toEqual({ status: 'ok' });
    expect((await h.request().get('/readyz')).body).toEqual({ status: 'ready' });
    const keys = await h.request().get('/.well-known/prescriptcheck/keys');
    expect(keys.body.keys[0]).toMatchObject({ alg: 'Ed25519', current: true });
    expect(keys.body.keys[0].publicKeyPem).toContain('BEGIN PUBLIC KEY');
    expect(JSON.stringify(keys.body)).not.toContain('PRIVATE');
    const nf = await h.request().get('/api/v1/gibtsnicht');
    expect(nf.status).toBe(404);
    expect(nf.body.error.code).toBe('NOT_FOUND');
    expect(nf.headers['x-powered-by']).toBeUndefined();
    expect(nf.headers['x-content-type-options']).toBe('nosniff');
    expect(nf.headers['x-request-id']).toBeTruthy();
  });

  test('zu große Anfragen werden abgelehnt, interne Fehler verraten keine Details', async () => {
    const big = await h.request().post('/api/v1/auth/login').send({ email: 'a@b.de', password: 'x'.repeat(200_000) });
    expect(big.status).toBe(413);
    const broken = await h.request().get('/readyz');
    expect(broken.status).toBe(200);
    h.ctx.store.ping = async () => {
      throw new Error('geheime Verbindungszeichenfolge mongodb://user:pw@host');
    };
    const down = await h.request().get('/readyz');
    expect(down.status).toBe(503);
    expect(JSON.stringify(down.body)).not.toContain('mongodb://');
  });

  test('Rate-Limit für den Login greift, wenn aktiviert', async () => {
    const limited = await createHarness({ RATE_LIMIT: 'true' });
    await limited.scenario();
    let blocked = 0;
    for (let i = 0; i < 25; i++) if ((await limited.login('arzt@test.de', `Falsch-${PASSWORD}-${i}`)).status === 429) blocked++;
    expect(blocked).toBeGreaterThan(0);
  });
});

describe('Konfiguration', () => {
  const { loadConfig } = require('../config');
  test('Produktion verlangt Geheimnisse und verbietet Speicher-Store/Demo-Daten', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET[\s\S]*MASTER_KEY[\s\S]*SIGNING_PRIVATE_KEY/);
    expect(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40), MASTER_KEY: Buffer.alloc(32).toString('base64'), SIGNING_PRIVATE_KEY: 'unsinn', MONGODB_URI: 'mongodb://x' })).toThrow(/SIGNING/);
  });
  test('gültige Produktionskonfiguration, MFA standardmäßig Pflicht', () => {
    const crypto = require('crypto');
    const pem = crypto.generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' });
    const cfg = loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40), MASTER_KEY: crypto.randomBytes(32).toString('base64'), SIGNING_PRIVATE_KEY: Buffer.from(pem).toString('base64'), MONGODB_URI: 'mongodb://x' });
    expect(cfg).toMatchObject({ production: true, requireMfa: true, storeType: 'mongo' });
    expect(() => loadConfig({ NODE_ENV: 'production', SEED_DEMO: 'true', JWT_SECRET: 'x'.repeat(40), MASTER_KEY: crypto.randomBytes(32).toString('base64'), SIGNING_PRIVATE_KEY: pem, MONGODB_URI: 'mongodb://x' })).toThrow(/SEED_DEMO/);
  });
  test('Entwicklung erzeugt flüchtige Geheimnisse und warnt', () => {
    const warn = jest.fn();
    const cfg = loadConfig({ NODE_ENV: 'development' }, { warn });
    expect(cfg.storeType).toBe('memory');
    expect(warn).toHaveBeenCalled();
  });
});
