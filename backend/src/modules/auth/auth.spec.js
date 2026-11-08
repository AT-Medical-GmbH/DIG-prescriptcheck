'use strict';

const { createHarness, PASSWORD } = require('../../testing/harness');
const { generateSecret, hotp, stepAt } = require('../../lib/totp');

describe('Authentifizierung', () => {
  let h;
  beforeEach(async () => {
    h = await createHarness();
    await h.scenario();
  });

  test('Login liefert Tokens und Nutzerprofil ohne Geheimnisse', async () => {
    const res = await h.login('arzt@test.de');
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user).toMatchObject({ email: 'arzt@test.de', role: 'PRESCRIBER', orgName: 'Praxis Dr. Test' });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|mfaSecret/);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  test('falsches Passwort und unbekannter Nutzer sind nicht unterscheidbar', async () => {
    const a = await h.login('arzt@test.de', 'falsch-falsch-1A');
    const b = await h.login('gibtsnicht@test.de', 'falsch-falsch-1A');
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error).toEqual(b.body.error);
  });

  test('Konto wird nach 5 Fehlversuchen für 15 Minuten gesperrt, danach wieder frei', async () => {
    for (let i = 0; i < 5; i++) expect((await h.login('arzt@test.de', 'falsch-falsch-1A')).status).toBe(401);
    const locked = await h.login('arzt@test.de');
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe('ACCOUNT_LOCKED');
    h.clock.advance(16 * 60 * 1000);
    expect((await h.login('arzt@test.de')).status).toBe(200);
  });

  test('deaktivierte Nutzer können sich nicht anmelden; bestehende Sitzungen enden sofort', async () => {
    const c = await h.as('arzt@test.de');
    const admin = await h.as('praxisadmin@test.de');
    const list = await admin.get('/org/users');
    const target = list.body.find((u) => u.email === 'arzt@test.de');
    expect((await admin.patch(`/users/${target.id}/status`).send({ status: 'DISABLED' })).status).toBe(200);
    expect((await c.get('/prescriptions')).status).toBe(401);
    expect((await h.login('arzt@test.de')).status).toBe(401);
  });

  test('Zugriff ohne/mit ungültigem Token wird abgelehnt', async () => {
    expect((await h.request().get('/api/v1/prescriptions')).status).toBe(401);
    expect((await h.request().get('/api/v1/prescriptions').set('Authorization', 'Bearer abc.def.ghi')).status).toBe(401);
  });

  test('Refresh rotiert das Token; Wiederverwendung beendet die Sitzung', async () => {
    const c = await h.as('arzt@test.de');
    const r1 = await h.request().post('/api/v1/auth/refresh').send({ refreshToken: c.refreshToken });
    expect(r1.status).toBe(200);
    expect(r1.body.refreshToken).not.toBe(c.refreshToken);
    // altes Token erneut → Diebstahlverdacht → Sitzung tot
    const replay = await h.request().post('/api/v1/auth/refresh').send({ refreshToken: c.refreshToken });
    expect(replay.status).toBe(401);
    const afterReplay = await h.request().post('/api/v1/auth/refresh').send({ refreshToken: r1.body.refreshToken });
    expect(afterReplay.status).toBe(401);
    expect((await h.request().get('/api/v1/auth/me').set('Authorization', `Bearer ${r1.body.accessToken}`)).status).toBe(401);
  });

  test('Logout beendet die Sitzung serverseitig', async () => {
    const c = await h.as('arzt@test.de');
    expect((await c.post('/auth/logout').send({})).status).toBe(204);
    expect((await c.get('/auth/me')).status).toBe(401);
  });

  test('Sitzung läuft nach 8 Stunden ab', async () => {
    const c = await h.as('arzt@test.de');
    h.clock.advance(8 * 3600 * 1000 + 1000);
    expect((await c.get('/prescriptions')).status).toBe(401);
  });

  test('Initialpasswort muss geändert werden; bis dahin sind andere Endpunkte gesperrt', async () => {
    await h.addUser('neu@test.de', 'PRACTICE_STAFF', (await h.ctx.col('organizations').findOne({ name: 'Praxis Dr. Test' }))._id, { mustChangePassword: true });
    const c = await h.as('neu@test.de');
    const blocked = await c.get('/prescriptions');
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
    // der Umgehungsversuch über einen Query-String hilft nicht
    expect((await c.get('/prescriptions?x=/auth/')).status).toBe(403);
    expect((await c.post('/auth/change-password').send({ currentPassword: PASSWORD, newPassword: 'kurz' })).status).toBe(400);
    expect((await c.post('/auth/change-password').send({ currentPassword: 'falsch', newPassword: 'Neues-Passwort-2026' })).status).toBe(401);
    expect((await c.post('/auth/change-password').send({ currentPassword: PASSWORD, newPassword: 'Neues-Passwort-2026' })).status).toBe(204);
    expect((await c.get('/prescriptions')).status).toBe(200);
    expect((await h.login('neu@test.de', PASSWORD)).status).toBe(401);
    expect((await h.login('neu@test.de', 'Neues-Passwort-2026')).status).toBe(200);
  });

  test('Eingaben werden validiert', async () => {
    expect((await h.request().post('/api/v1/auth/login').send({})).status).toBe(400);
    expect((await h.request().post('/api/v1/auth/login').send({ email: 'kaputt', password: 'x' })).status).toBe(400);
    expect((await h.request().post('/api/v1/auth/login').send({ email: 'a@b.de', password: 123 })).status).toBe(400);
    const bad = await h.request().post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{kaputt');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('INVALID_JSON');
  });
});

describe('Zwei-Faktor-Authentifizierung (TOTP)', () => {
  test('Einrichtung, Pflicht beim Login, Replay-Schutz und Erzwingung', async () => {
    const h = await createHarness({ REQUIRE_MFA: 'true' });
    await h.scenario();
    const c = await h.as('arzt@test.de');

    // Ohne MFA-Einrichtung sind Fachendpunkte gesperrt
    const gated = await c.get('/prescriptions');
    expect(gated.status).toBe(403);
    expect(gated.body.error.code).toBe('MFA_ENROLLMENT_REQUIRED');

    const enroll = await c.post('/auth/mfa/enroll').send({});
    expect(enroll.status).toBe(200);
    expect(enroll.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    expect((await c.post('/auth/mfa/confirm').send({ code: '000000' })).status).toBe(400);
    const step = stepAt(h.clock.now());
    expect((await c.post('/auth/mfa/confirm').send({ code: hotp(enroll.body.secret, step) })).status).toBe(204);
    expect((await c.get('/prescriptions')).status).toBe(200);

    // Login verlangt jetzt den Code
    const noCode = await h.login('arzt@test.de');
    expect(noCode.status).toBe(401);
    expect(noCode.body.error.code).toBe('MFA_REQUIRED');
    // Der Code des Einrichtungsschritts ist verbraucht (Replay-Schutz)
    const replay = await h.login('arzt@test.de', PASSWORD, hotp(enroll.body.secret, step));
    expect(replay.status).toBe(401);
    h.clock.advance(30 * 1000);
    const ok = await h.login('arzt@test.de', PASSWORD, hotp(enroll.body.secret, stepAt(h.clock.now())));
    expect(ok.status).toBe(200);
    expect(ok.body.user.mfaEnabled).toBe(true);
    // zweite Einrichtung nicht möglich
    expect((await c.post('/auth/mfa/enroll').send({})).status).toBe(409);
  });

  test('Fehlerhafter Code zählt als Fehlversuch', async () => {
    const h = await createHarness();
    await h.scenario();
    const secret = generateSecret();
    await h.ctx.col('users').updateOne({ email: 'arzt@test.de' }, { $set: { mfaEnabled: true, mfaSecretEnc: h.ctx.vault.encrypt((await h.ctx.col('users').findOne({ email: 'arzt@test.de' })).orgId, secret) } });
    for (let i = 0; i < 5; i++) expect((await h.login('arzt@test.de', PASSWORD, '123456')).status).toBe(401);
    expect((await h.login('arzt@test.de', PASSWORD, hotp(secret, stepAt(h.clock.now())))).status).toBe(429);
  });
});
