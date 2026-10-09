'use strict';

const { createHarness } = require('../../testing/harness');

const MIN = 60 * 1000;

describe('Prüfung, Identitätsabgleich und Einlösung (Apotheke)', () => {
  let h;
  let arzt;
  let apo;
  let rx;
  let code;

  const codeOf = async (r) => (await h.ctx.col('prescriptions').findOne({ _id: r.id })).code;
  const check = (client, body) => client.post('/verifications').send(body);
  const identify = (client, vid, dob = '1980-05-17') => client.post(`/verifications/${vid}/identity-check`).send({ dob });

  /** Prüfung + Abgleich → Token */
  async function readyToRedeem(client, scanCode = code) {
    const c = await check(client, { code: scanCode });
    expect(c.status).toBe(200);
    const id = await identify(client, c.body.verificationId);
    expect(id.status).toBe(200);
    return { vid: c.body.verificationId, token: id.body.redemptionToken, content: id.body.content };
  }

  beforeEach(async () => {
    h = await createHarness();
    await h.scenario();
    arzt = await h.as('arzt@test.de');
    apo = await h.as('apotheker@test.de');
    rx = await h.issueRx(arzt);
    code = await codeOf(rx);
  });

  describe('Prüfung (Ampel)', () => {
    test('GRÜN per Code und per Seriennummer – ohne Patientendaten', async () => {
      const byCode = await check(apo, { code });
      expect(byCode.status).toBe(200);
      expect(byCode.body).toMatchObject({ result: 'GREEN', reasons: [], serial: rx.serial, practiceName: 'Praxis Dr. Test', prescriberName: 'Test PRESCRIBER' });
      expect(JSON.stringify(byCode.body)).not.toMatch(/Mustermann|Ibuprofen|1980|dobMac/);
      const bySerial = await check(apo, { serial: rx.serial.toLowerCase().replace(/-/g, ' ') });
      expect(bySerial.body.result).toBe('GREEN');
    });

    test('ROT: manipulierter oder fremder Code, ungültige/unbekannte Seriennummer', async () => {
      const t = Buffer.from(code.slice(4), 'base64url');
      t[12] ^= 1; // Seriennummer im Code verändert
      expect((await check(apo, { code: `PC1:${t.toString('base64url')}` })).body).toMatchObject({ result: 'RED', reasons: ['SIGNATURE_INVALID'] });
      expect((await check(apo, { code: 'PC1:Zm9v' })).body.reasons).toEqual(['CODE_UNREADABLE']);
      expect((await check(apo, { code: 'irgendwas' })).body.reasons).toEqual(['CODE_UNREADABLE']);
      expect((await check(apo, { serial: 'PC-26-AAAA-AAAA-A' })).body.reasons).toEqual(['SERIAL_INVALID']);
      // gültig aufgebaute, aber unbekannte Seriennummer
      const { generateSerial } = require('../../lib/ids');
      expect((await check(apo, { serial: generateSerial(h.clock.now()).serial })).body.reasons).toEqual(['UNKNOWN']);
      expect((await check(apo, {})).body.result).toBe('RED');
    });

    test('ROT: Entwurf ist nicht prüfbar', async () => {
      const d = (await arzt.post('/prescriptions').send(h.draftBody())).body;
      expect(d.serial).toBeNull();
    });

    test('ROT: Code stimmt nicht mit dem gespeicherten Rezept überein (Datenbank-Manipulation)', async () => {
      // Angreifer tauscht den Inhalt in der Datenbank aus (gültig verschlüsselt, aber anderer Hash)
      const doc = await h.ctx.col('prescriptions').findOne({ _id: rx.id });
      const content = h.ctx.vault.decryptJson(doc.practiceOrgId, doc.contentEnc);
      content.items[0].quantity = 'N3 (100 Stück)';
      await h.ctx.col('prescriptions').updateOne({ _id: rx.id }, { $set: { contentEnc: h.ctx.vault.encryptJson(doc.practiceOrgId, content) } });
      expect((await check(apo, { code })).body).toMatchObject({ result: 'RED', reasons: ['INTEGRITY_FAILED'] });
    });

    test('ROT: gesperrt (mit Sperrgrund), eingelöst, abgelaufen', async () => {
      await arzt.post(`/prescriptions/${rx.id}/block`).send({ reason: 'THEFT' });
      expect((await check(apo, { code })).body).toMatchObject({ result: 'RED', reasons: ['BLOCKED'], blockReason: 'THEFT' });
      await arzt.post(`/prescriptions/${rx.id}/unblock`).send({ reason: 'ok' });
      expect((await check(apo, { code })).body.result).toBe('GREEN');
      h.clock.advance(29 * 24 * 3600 * 1000);
      apo = await h.as('apotheker@test.de'); // Sitzung (8 h) ist inzwischen abgelaufen
      expect((await check(apo, { code })).body).toMatchObject({ result: 'RED', reasons: ['EXPIRED'] });
    });

    test('GELB: Duplikat-Ausdruck, baldiger Ablauf, QS-Markierung', async () => {
      await arzt.get(`/prescriptions/${rx.id}/pdf`);
      expect((await check(apo, { code })).body.result).toBe('GREEN'); // erster Druck ist normal
      await arzt.get(`/prescriptions/${rx.id}/pdf`);
      expect((await check(apo, { code })).body).toMatchObject({ result: 'YELLOW', reasons: ['DUPLICATE_PRINT'] });
      h.clock.advance(27 * 24 * 3600 * 1000);
      apo = await h.as('apotheker@test.de');
      expect((await check(apo, { code })).body.reasons).toEqual(expect.arrayContaining(['EXPIRES_SOON']));
      await h.ctx.col('prescriptions').updateOne({ _id: rx.id }, { $push: { qsFlags: { type: 'TEST' } } });
      expect((await check(apo, { code })).body.reasons).toEqual(expect.arrayContaining(['QS_FLAGGED']));
    });

    test('Prüfung ist nur für Apothekenpersonal erlaubt', async () => {
      expect((await check(arzt, { code })).status).toBe(403);
      expect((await check(await h.as('praxisadmin@test.de'), { code })).status).toBe(403);
    });
  });

  describe('Identitätsabgleich', () => {
    test('richtiges Geburtsdatum liefert Inhalt und Einlösetoken, falsches nicht', async () => {
      const c = await check(apo, { code });
      const wrong = await identify(apo, c.body.verificationId, '1980-05-18');
      expect(wrong.status).toBe(403);
      expect(wrong.body.error.code).toBe('IDENTITY_MISMATCH');
      expect(JSON.stringify(wrong.body)).not.toMatch(/Mustermann|Ibuprofen|redemptionToken/);

      const ok = await identify(apo, c.body.verificationId);
      expect(ok.status).toBe(200);
      expect(ok.body.redemptionToken).toBeTruthy();
      expect(ok.body.content).toMatchObject({ serial: rx.serial, patientName: 'Max Mustermann', practiceName: 'Praxis Dr. Test' });
      expect(ok.body.content.items[0].medication).toBe('Ibuprofen 400 mg');
      expect(JSON.stringify(ok.body)).not.toContain('1980-05-17'); // Geburtsdatum wird nie ausgegeben
    });

    test('drei Fehlversuche sperren das Rezept 15 Minuten, informieren die Praxis und markieren es für die QS', async () => {
      const c = await check(apo, { code });
      expect((await identify(apo, c.body.verificationId, '1999-01-01')).status).toBe(403);
      expect((await identify(apo, c.body.verificationId, '1999-01-02')).status).toBe(403);
      const third = await identify(apo, c.body.verificationId, '1999-01-03');
      expect(third.status).toBe(429);
      expect(third.body.error.code).toBe('TEMP_LOCKED');
      // selbst das richtige Datum geht jetzt nicht
      expect((await identify(apo, c.body.verificationId)).status).toBe(429);
      expect((await check(apo, { code })).body).toMatchObject({ result: 'RED', reasons: ['TEMP_LOCKED'] });

      const notes = (await arzt.get('/notifications')).body;
      expect(notes.map((n) => n.type)).toContain('DOB_FAILS');
      expect(JSON.stringify(notes)).not.toMatch(/Mustermann/);
      expect((await arzt.get(`/prescriptions/${rx.id}`)).body.qsFlags[0].type).toBe('DOB_FAILS');

      h.clock.advance(16 * MIN);
      const again = await check(apo, { code });
      expect(again.body.result).toBe('YELLOW'); // QS-Markierung bleibt sichtbar
      expect((await identify(apo, again.body.verificationId)).status).toBe(200);
    });

    test('ungültiges Datum zählt nicht als Fehlversuch', async () => {
      const c = await check(apo, { code });
      for (let i = 0; i < 5; i++) expect((await identify(apo, c.body.verificationId, 'kein-datum')).status).toBe(400);
      expect((await identify(apo, c.body.verificationId)).status).toBe(200);
    });

    test('Prüfvorgang läuft nach 10 Minuten ab und ist an Nutzer/Apotheke gebunden', async () => {
      const c = await check(apo, { code });
      expect((await identify(await h.as('apotheker2@test.de'), c.body.verificationId)).status).toBe(404);
      expect((await identify(await h.as('apotheker-b@test.de'), c.body.verificationId)).status).toBe(404);
      h.clock.advance(11 * MIN);
      const late = await identify(apo, c.body.verificationId);
      expect(late.status).toBe(409);
      expect(late.body.error.code).toBe('VERIFICATION_EXPIRED');
    });
  });

  describe('Einlösung', () => {
    test('vollständiger Ablauf: Einlösen, Praxis-Rückmeldung, Wiederholung unmöglich, Audit in beiden Ketten', async () => {
      const { token } = await readyToRedeem(apo);
      const red = await apo.post('/redemptions').send({ token, pickedUpBy: 'PATIENT' });
      expect(red.status).toBe(201);
      expect(red.body).toMatchObject({ serial: rx.serial });
      expect(red.body.cancelUntil - red.body.redeemedAt).toBe(15 * MIN);

      // erneute Verwendung desselben Tokens / erneute Prüfung
      expect((await apo.post('/redemptions').send({ token })).status).toBe(401);
      expect((await check(apo, { code })).body).toMatchObject({ result: 'RED', reasons: ['ALREADY_REDEEMED'] });
      expect((await check(await h.as('apotheker-b@test.de'), { code })).body.reasons).toEqual(['ALREADY_REDEEMED']);

      // Praxis sieht Einlösung
      const detail = (await arzt.get(`/prescriptions/${rx.id}`)).body;
      expect(detail).toMatchObject({ state: 'REDEEMED', redeemedByPharmacy: 'Test-Apotheke' });
      expect((await arzt.get('/notifications')).body.map((n) => n.type)).toContain('REDEEMED');
      expect((await arzt.post(`/prescriptions/${rx.id}/block`).send({ reason: 'ERROR' })).status).toBe(409);

      const pharmAudit = (await (await h.as('apothekeadmin@test.de')).get('/audit?limit=100')).body.entries.map((e) => e.action);
      const practiceAudit = (await (await h.as('praxisadmin@test.de')).get('/audit?limit=100')).body.entries.map((e) => e.action);
      expect(pharmAudit).toEqual(expect.arrayContaining(['VERIFY_CHECK', 'VERIFY_IDENTITY_OK', 'RX_REDEEMED']));
      expect(practiceAudit).toEqual(expect.arrayContaining(['RX_ISSUED', 'RX_REDEEMED', 'VERIFY_CHECK']));
      for (const email of ['apothekeadmin@test.de', 'praxisadmin@test.de']) expect((await (await h.as(email)).get('/audit/verify')).body.ok).toBe(true);
    });

    test('Token ist nutzer-, apotheken- und zeitgebunden und ohne Abgleich nicht erzeugbar', async () => {
      const { token } = await readyToRedeem(apo);
      expect((await (await h.as('apotheker2@test.de')).post('/redemptions').send({ token })).status).toBe(401);
      expect((await (await h.as('apotheker-b@test.de')).post('/redemptions').send({ token })).status).toBe(401);
      expect((await apo.post('/redemptions').send({ token: 'erfunden' })).status).toBe(401);
      expect((await apo.post('/redemptions').send({})).status).toBe(400);
      h.clock.advance(6 * MIN);
      const late = await apo.post('/redemptions').send({ token });
      expect(late.status).toBe(401);
      expect(late.body.error.code).toBe('TOKEN_INVALID');
      expect((await arzt.post('/redemptions').send({ token })).status).toBe(403);
    });

    test('Token wird im Klartext nicht gespeichert', async () => {
      const { token } = await readyToRedeem(apo);
      expect(JSON.stringify(await h.ctx.col('redemption_tokens').find({}))).not.toContain(token);
    });

    test('Rezept, das zwischen Abgleich und Einlösung gesperrt wird, ist nicht einlösbar', async () => {
      const { token } = await readyToRedeem(apo);
      await arzt.post(`/prescriptions/${rx.id}/block`).send({ reason: 'THEFT' });
      const r = await apo.post('/redemptions').send({ token });
      expect(r.status).toBe(409);
      expect(r.body.error.code).toBe('NOT_REDEEMABLE');
      expect((await arzt.get(`/prescriptions/${rx.id}`)).body.state).toBe('BLOCKED');
    });

    test('Rezept, das zwischen Abgleich und Einlösung abläuft, ist nicht einlösbar', async () => {
      const { token } = await readyToRedeem(apo);
      h.clock.advance(4 * MIN);
      // Ablauf knapp nach dem Abgleich
      await h.ctx.col('prescriptions').updateOne({ _id: rx.id }, { $set: { expiresAt: h.clock.now() - 1 } });
      expect((await apo.post('/redemptions').send({ token })).status).toBe(409);
    });

    test('NEBENLÄUFIGKEIT: parallele Einlösung desselben Rezepts durch mehrere Apotheken – genau eine gewinnt', async () => {
      const clients = [apo, await h.as('apotheker2@test.de'), await h.as('apotheker-b@test.de')];
      const prepared = [];
      for (const c of clients) prepared.push({ c, ...(await readyToRedeem(c)) });
      const results = await Promise.all(prepared.map(({ c, token }) => c.post('/redemptions').send({ token })));
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(results.filter((r) => r.status === 409)).toHaveLength(2);
      const doc = await h.ctx.col('prescriptions').findOne({ _id: rx.id });
      expect(doc.state).toBe('REDEEMED');
      const redeemedEntries = (await h.ctx.audit.list(doc.practiceOrgId, { limit: 200 })).filter((e) => e.action === 'RX_REDEEMED');
      expect(redeemedEntries).toHaveLength(1);
      expect((await h.ctx.audit.verify(doc.practiceOrgId)).ok).toBe(true);
    });

    test('NEBENLÄUFIGKEIT: Doppelklick (dasselbe Token zweimal gleichzeitig) löst nur einmal ein', async () => {
      const { token } = await readyToRedeem(apo);
      const results = await Promise.all([apo.post('/redemptions').send({ token }), apo.post('/redemptions').send({ token })]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 401]);
    });

    test('gesperrte Apotheke kann nicht einlösen', async () => {
      const { token } = await readyToRedeem(apo);
      await h.ctx.col('organizations').updateOne({ name: 'Test-Apotheke' }, { $set: { status: 'SUSPENDED' } });
      expect((await apo.post('/redemptions').send({ token })).status).toBe(403);
    });
  });

  describe('Storno und Verdachtsmeldung', () => {
    test('Einlösestorno innerhalb von 15 Minuten durch dieselbe Apotheke macht das Rezept wieder einlösbar', async () => {
      const { token } = await readyToRedeem(apo);
      await apo.post('/redemptions').send({ token });
      expect((await (await h.as('apotheker-b@test.de')).post(`/redemptions/${rx.serial}/cancel`).send({ reason: 'x' })).status).toBe(404);
      expect((await apo.post(`/redemptions/${rx.serial}/cancel`).send({})).status).toBe(400);
      const list = await apo.get('/redemptions');
      expect(list.body[0]).toMatchObject({ serial: rx.serial, cancellable: true });
      expect(JSON.stringify(list.body)).not.toMatch(/Mustermann/);

      const c = await apo.post(`/redemptions/${rx.serial}/cancel`).send({ reason: 'Fehlbedienung' });
      expect(c.status).toBe(200);
      expect((await check(apo, { code })).body.result).toBe('GREEN');
      expect((await arzt.get('/notifications')).body.map((n) => n.type)).toContain('REDEMPTION_CANCELLED');
      // zweite Einlösung ist wieder möglich
      const again = await readyToRedeem(apo);
      expect((await apo.post('/redemptions').send({ token: again.token })).status).toBe(201);
    });

    test('Storno nach Ablauf der Frist wird abgelehnt; Pharmaziepersonal ohne Approbation darf nicht stornieren', async () => {
      const { token } = await readyToRedeem(apo);
      await apo.post('/redemptions').send({ token });
      h.clock.advance(16 * MIN);
      const late = await apo.post(`/redemptions/${rx.serial}/cancel`).send({ reason: 'zu spät' });
      expect(late.status).toBe(409);
      expect(late.body.error.code).toBe('CANCEL_WINDOW_OVER');
      await h.addUser('pta@test.de', 'PHARMACY_STAFF', (await h.ctx.col('organizations').findOne({ name: 'Test-Apotheke' }))._id);
      expect((await (await h.as('pta@test.de')).post(`/redemptions/${rx.serial}/cancel`).send({ reason: 'x' })).status).toBe(403);
    });

    test('Verdachtsmeldung sperrt das Rezept, informiert die Praxis; nur QS kann entsperren', async () => {
      const c = await check(apo, { code });
      expect((await apo.post('/qs/reports').send({ verificationId: c.body.verificationId, category: 'UNSINN' })).status).toBe(400);
      expect((await apo.post('/qs/reports').send({ verificationId: 'fremd', category: 'FORGERY_SUSPECTED' })).status).toBe(404);
      const rep = await apo.post('/qs/reports').send({ verificationId: c.body.verificationId, category: 'FORGERY_SUSPECTED', note: 'Schrift wirkt verändert' });
      expect(rep.status).toBe(201);
      expect(rep.body.blocked).toBe(true);
      expect((await check(apo, { code })).body).toMatchObject({ result: 'RED', reasons: ['BLOCKED'] });
      expect((await arzt.get('/notifications')).body.map((n) => n.type)).toContain('QS_REPORT');

      // Praxis kann eine QS-Sperre nicht selbst aufheben
      const un = await arzt.post(`/prescriptions/${rx.id}/unblock`).send({ reason: 'ich will' });
      expect(un.status).toBe(403);
      expect(un.body.error.code).toBe('QS_BLOCK');

      // QS sieht Metadaten ohne Patientendaten und kann entsperren
      const qs = await h.as('qs@test.de');
      const flagged = await qs.get('/qs/flagged');
      expect(flagged.body[0]).toMatchObject({ serial: rx.serial, practiceName: 'Praxis Dr. Test', state: 'BLOCKED' });
      expect(JSON.stringify(flagged.body)).not.toMatch(/Mustermann|Ibuprofen/);
      expect((await apo.post(`/qs/prescriptions/${rx.serial}/unblock`).send({ reason: 'x' })).status).toBe(403);
      expect((await qs.post(`/qs/prescriptions/${rx.serial}/unblock`).send({})).status).toBe(400);
      expect((await qs.post(`/qs/prescriptions/${rx.serial}/unblock`).send({ reason: 'Praxis hat bestätigt' })).status).toBe(200);
      expect((await check(apo, { code })).body.result).toBe('GREEN');
    });
  });
});
