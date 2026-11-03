'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { createHarness, PASSWORD } = require('../../testing/harness');
const { generateSecret, hotp, stepAt } = require('../../lib/totp');
const { loadConfig } = require('../../config');

describe('Härtung: Anmeldung', () => {
  let h;
  beforeEach(async () => {
    h = await createHarness();
    await h.scenario();
  });

  test('parallele Fehlversuche werden alle gezählt (atomarer Zähler)', async () => {
    await Promise.all(Array.from({ length: 5 }, () => h.login('arzt@test.de', 'falsch-falsch-1A')));
    const res = await h.login('arzt@test.de');
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
  });

  test('Sperrstatus wird nur mit richtigem Passwort offengelegt und Versuche verlängern die Sperre nicht', async () => {
    for (let i = 0; i < 5; i++) await h.login('arzt@test.de', 'falsch-falsch-1A');
    const before = (await h.ctx.col('users').findOne({ email: 'arzt@test.de' })).lockedUntil;
    const wrong = await h.login('arzt@test.de', 'falsch-falsch-1A');
    const unknown = await h.login('gibtsnicht@test.de', 'falsch-falsch-1A');
    expect(wrong.status).toBe(401);
    expect(wrong.body.error).toEqual(unknown.body.error);
    const after = await h.ctx.col('users').findOne({ email: 'arzt@test.de' });
    expect(after.lockedUntil).toBe(before);
    expect(after.failedLogins || 0).toBe(0);
  });

  test('ein TOTP-Code ist auch bei parallelen Anfragen genau einmal einlösbar', async () => {
    const secret = generateSecret();
    const u = await h.ctx.col('users').findOne({ email: 'arzt@test.de' });
    await h.ctx.col('users').updateOne({ _id: u._id }, { $set: { mfaEnabled: true, mfaSecretEnc: h.ctx.vault.encrypt(u.orgId, secret) } });
    const code = hotp(secret, stepAt(h.clock.now()));
    const results = await Promise.all([1, 2, 3, 4].map(() => h.login('arzt@test.de', PASSWORD, code)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 401)).toHaveLength(3);
  });
});

describe('Härtung: gesperrte Organisation', () => {
  test('gesperrte Praxis kann weder Entwürfe anlegen/ändern noch Sperren aufheben, aber weiter sperren', async () => {
    const h = await createHarness();
    const s = await h.scenario();
    const arzt = await h.as('arzt@test.de');
    const rx = await h.issueRx(arzt);
    const draft = await arzt.post('/prescriptions').send(h.draftBody());
    expect(draft.status).toBe(201);
    expect((await arzt.post(`/prescriptions/${rx.id}/block`).send({ reason: 'ERROR' })).status).toBe(200);

    await h.ctx.col('organizations').updateOne({ _id: s.practice._id }, { $set: { status: 'SUSPENDED' } });
    const create = await arzt.post('/prescriptions').send(h.draftBody());
    expect(create.status).toBe(403);
    expect(create.body.error.code).toBe('ORG_SUSPENDED');
    expect((await arzt.put(`/prescriptions/${draft.body.id}`).send(h.draftBody())).status).toBe(403);
    expect((await arzt.post(`/prescriptions/${rx.id}/unblock`).send({ reason: 'doch wieder frei' })).status).toBe(403);
    expect((await arzt.get(`/prescriptions/${rx.id}`)).status).toBe(200);
  });
});

describe('Härtung: Verdachtsmeldungen', () => {
  test('Meldung nach der Einlösung geht nicht verloren, erreicht die QS und verrät der Praxis keine Details', async () => {
    const h = await createHarness();
    await h.scenario();
    const arzt = await h.as('arzt@test.de');
    const apo = await h.as('apotheker@test.de');
    const rx = await h.issueRx(arzt);
    const code = (await h.ctx.col('prescriptions').findOne({ _id: rx.id })).code;
    const c = await apo.post('/verifications').send({ code });
    const id = await apo.post(`/verifications/${c.body.verificationId}/identity-check`).send({ dob: '1980-05-17' });
    expect((await apo.post('/redemptions').send({ token: id.body.redemptionToken })).status).toBe(201);

    const rep = await apo.post('/qs/reports').send({ verificationId: c.body.verificationId, category: 'FORGERY_SUSPECTED', note: 'vertrauliche Notiz' });
    expect(rep.status).toBe(201);
    expect(rep.body.blocked).toBe(false);

    const qs = await h.as('qs@test.de');
    const flagged = await qs.get('/qs/flagged');
    expect(flagged.body.map((r) => r.serial)).toContain(rx.serial);
    expect(flagged.body.find((r) => r.serial === rx.serial).state).toBe('REDEEMED');

    const seen = await arzt.get(`/prescriptions/${rx.id}`);
    expect(seen.body.qsFlags).toEqual([expect.objectContaining({ type: 'PHARMACY_REPORT', category: 'FORGERY_SUSPECTED' })]);
    expect(JSON.stringify(seen.body.qsFlags)).not.toMatch(/vertrauliche Notiz|orgId/);
  });
});

describe('Härtung: Konfiguration', () => {
  const base = () => ({
    NODE_ENV: 'production',
    JWT_SECRET: 'x'.repeat(40),
    MASTER_KEY: crypto.randomBytes(32).toString('base64'),
    SIGNING_PRIVATE_KEY: Buffer.from(crypto.generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' })).toString('base64'),
    MONGODB_URI: 'mongodb://x',
  });

  test('TRUST_PROXY ist in Produktion Pflicht und wird geparst', () => {
    expect(() => loadConfig(base())).toThrow(/TRUST_PROXY/);
    expect(loadConfig({ ...base(), TRUST_PROXY: '1' }).trustProxy).toBe(1);
    expect(loadConfig({ ...base(), TRUST_PROXY: '0' }).trustProxy).toBe(false);
    expect(loadConfig({ ...base(), TRUST_PROXY: 'true' }).trustProxy).toBe(true);
    expect(loadConfig({ ...base(), TRUST_PROXY: 'loopback, 172.16.0.0/12' }).trustProxy).toBe('loopback, 172.16.0.0/12');
  });

  test('Geheimnisse können als Datei (NAME_FILE) übergeben werden', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-secret-'));
    const file = path.join(dir, 'jwt');
    fs.writeFileSync(file, `${'y'.repeat(40)}\n`);
    const { JWT_SECRET, ...rest } = base();
    const cfg = loadConfig({ ...rest, JWT_SECRET_FILE: file, TRUST_PROXY: '1' });
    expect(cfg.jwtSecret).toBe('y'.repeat(40));
    expect(() => loadConfig({ ...rest, JWT_SECRET, JWT_SECRET_FILE: file, TRUST_PROXY: '1' })).toThrow(/gleichzeitig/);
    expect(() => loadConfig({ ...rest, JWT_SECRET_FILE: path.join(dir, 'fehlt'), TRUST_PROXY: '1' })).toThrow(/nicht lesbar/);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('Härtung: Verwaltung und Eingaben', () => {
  let h;
  let admin;
  beforeEach(async () => {
    h = await createHarness();
    await h.scenario();
    admin = await h.as('admin@test.de');
  });

  test('Plattform-Admin kann Plattform-Konten nicht zurücksetzen; Org-Konten schon, die Organisation wird informiert', async () => {
    const qsUser = await h.ctx.col('users').findOne({ email: 'qs@test.de' });
    const denied = await admin.post(`/users/${qsUser._id}/reset-credentials`).send({});
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('PLATFORM_ACCOUNT');

    const arzt = await h.ctx.col('users').findOne({ email: 'arzt@test.de' });
    const ok = await admin.post(`/users/${arzt._id}/reset-credentials`).send({ resetMfa: true });
    expect(ok.status).toBe(200);
    const notes = (await (await h.as('praxisadmin@test.de')).get('/notifications')).body;
    expect(notes.map((n) => n.type)).toContain('CREDENTIALS_RESET');
    expect(JSON.stringify(notes)).not.toContain(ok.body.initialPassword);
  });

  test('manipulierte Query-Parameter führen zu 400 statt zu Serverfehlern', async () => {
    const arzt = await h.as('arzt@test.de');
    for (const qs of ['q=a&q=b', 'state=ISSUED&state=BLOCKED', 'state=GIBTSNICHT', `q=${'x'.repeat(101)}`]) {
      const res = await arzt.get(`/prescriptions?${qs}`);
      expect(res.status).toBe(400);
    }
    expect((await arzt.get('/prescriptions?limit=5&limit=6')).status).toBe(200);
  });

  test('Passwortwechsel ist je Nutzer ratenbegrenzt', async () => {
    const limited = await createHarness({ RATE_LIMIT: 'true' });
    await limited.scenario();
    const c = await limited.as('arzt@test.de');
    let last;
    for (let i = 0; i < 21; i++) last = await c.post('/auth/change-password').send({ currentPassword: 'falsch-falsch-1A', newPassword: 'Neues-Passwort-123!' });
    expect(last.status).toBe(429);
  });
});
