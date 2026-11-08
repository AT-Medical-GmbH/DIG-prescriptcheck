'use strict';

const { createHarness } = require('../../testing/harness');

describe('Rezepte (Praxis)', () => {
  let h;
  let s;
  let arzt;
  beforeEach(async () => {
    h = await createHarness();
    s = await h.scenario();
    arzt = await h.as('arzt@test.de');
  });

  test('Entwurf → Ausstellen: Seriennummer, Gültigkeit, Unveränderlichkeit', async () => {
    const draft = await arzt.post('/prescriptions').send(h.draftBody());
    expect(draft.status).toBe(201);
    expect(draft.body).toMatchObject({ state: 'DRAFT', serial: null, patientName: 'Max Mustermann' });

    const upd = await arzt.put(`/prescriptions/${draft.body.id}`).send(h.draftBody({ note: 'geändert' }));
    expect(upd.status).toBe(200);
    expect(upd.body.note).toBe('geändert');

    const issued = await arzt.post(`/prescriptions/${draft.body.id}/issue`).send({});
    expect(issued.status).toBe(200);
    expect(issued.body.state).toBe('ISSUED');
    expect(issued.body.serial).toMatch(/^PC-26-/);
    expect(issued.body.expiresAt - issued.body.issuedAt).toBe(28 * 24 * 3600 * 1000);
    expect(issued.body.prescriberName).toBe('Test PRESCRIBER');

    // nach dem Ausstellen unveränderlich, nicht erneut ausstellbar
    expect((await arzt.put(`/prescriptions/${draft.body.id}`).send(h.draftBody())).status).toBe(409);
    expect((await arzt.post(`/prescriptions/${draft.body.id}/issue`).send({})).status).toBe(409);
    expect((await arzt.post(`/prescriptions/${draft.body.id}/discard`).send({})).status).toBe(409);
    // Abruf per Seriennummer funktioniert ebenfalls
    expect((await arzt.get(`/prescriptions/${issued.body.serial}`)).body.id).toBe(draft.body.id);
  });

  test('individuelle Gültigkeitsdauer', async () => {
    const rx = await h.issueRx(arzt, h.draftBody({ validityDays: 7 }));
    expect(rx.expiresAt - rx.issuedAt).toBe(7 * 24 * 3600 * 1000);
    const bad = await arzt.post('/prescriptions').send(h.draftBody({ validityDays: 500 }));
    expect(bad.status).toBe(400);
  });

  test('Gesundheitsdaten liegen nicht im Klartext in der Datenbank', async () => {
    const rx = await h.issueRx(arzt);
    const raw = JSON.stringify(await h.ctx.col('prescriptions').findOne({ _id: rx.id }));
    for (const secret of ['Mustermann', 'Ibuprofen', '1980-05-17', 'Testrezept']) expect(raw).not.toContain(secret);
    expect(raw).toContain('v1.'); // verschlüsseltes Format
  });

  test('Validierung der Eingaben', async () => {
    const bad = [
      { ...h.draftBody(), items: [] },
      { ...h.draftBody(), patient: { name: 'X', dob: '2999-01-01' } },
      { ...h.draftBody(), patient: { name: '', dob: '1980-01-01' } },
      { ...h.draftBody(), items: [{ medication: 'A' }] },
      { ...h.draftBody(), items: Array.from({ length: 11 }, () => ({ medication: 'A', quantity: '1' })) },
      {},
    ];
    for (const b of bad) expect((await arzt.post('/prescriptions').send(b)).status).toBe(400);
  });

  test('Entwurf kann verworfen werden und ist danach nicht mehr ausstellbar', async () => {
    const d = (await arzt.post('/prescriptions').send(h.draftBody())).body;
    expect((await arzt.post(`/prescriptions/${d.id}/discard`).send({})).body.state).toBe('DISCARDED');
    expect((await arzt.post(`/prescriptions/${d.id}/issue`).send({})).status).toBe(409);
  });

  test('Praxispersonal darf Entwürfe anlegen, aber nicht ausstellen oder sperren', async () => {
    const staff = await h.as('mfa@test.de');
    const d = await staff.post('/prescriptions').send(h.draftBody());
    expect(d.status).toBe(201);
    expect((await staff.post(`/prescriptions/${d.body.id}/issue`).send({})).status).toBe(403);
    const rx = await h.issueRx(arzt);
    expect((await staff.post(`/prescriptions/${rx.id}/block`).send({ reason: 'ERROR' })).status).toBe(403);
    expect((await staff.get(`/prescriptions/${rx.id}/pdf`)).status).toBe(200); // Druck ist erlaubt
  });

  test('Sperren und Entsperren durch die verordnende Person', async () => {
    const rx = await h.issueRx(arzt);
    expect((await arzt.post(`/prescriptions/${rx.id}/block`).send({ reason: 'egal' })).status).toBe(400);
    const blocked = await arzt.post(`/prescriptions/${rx.id}/block`).send({ reason: 'THEFT' });
    expect(blocked.body).toMatchObject({ state: 'BLOCKED', blockReason: 'THEFT', blockedBy: 'PRESCRIBER' });
    expect((await arzt.post(`/prescriptions/${rx.id}/block`).send({ reason: 'THEFT' })).status).toBe(409);
    expect((await arzt.get(`/prescriptions/${rx.id}/pdf`)).status).toBe(409); // gesperrt: kein Druck
    expect((await arzt.post(`/prescriptions/${rx.id}/unblock`).send({})).status).toBe(400); // Begründung Pflicht
    const un = await arzt.post(`/prescriptions/${rx.id}/unblock`).send({ reason: 'Irrtum' });
    expect(un.body.state).toBe('ISSUED');
  });

  test('Mehrfachsperre und Notfallsperre', async () => {
    const a = await h.issueRx(arzt);
    const b = await h.issueRx(arzt);
    const other = await h.issueRx(await h.as('arzt2@test.de'));
    const bulk = await arzt.post('/prescriptions/block-bulk').send({ ids: [a.id, b.id, 'gibtsnicht'], reason: 'ERROR' });
    expect(bulk.body.blocked).toBe(2);
    expect(bulk.body.results.find((r) => r.id === 'gibtsnicht')).toMatchObject({ ok: false, error: 'RX_NOT_FOUND' });

    const c = await h.issueRx(arzt);
    const all = await arzt.post('/prescriptions/block-all-open').send({ reason: 'LOSS' });
    expect(all.body.blocked).toBe(1); // nur c; a, b waren schon gesperrt; other gehört dem anderen Arzt
    expect((await arzt.get(`/prescriptions/${c.id}`)).body.state).toBe('BLOCKED');
    expect((await arzt.get(`/prescriptions/${other.id}`)).body.state).toBe('ISSUED');
  });

  test('Drucken: gültiges PDF; erneuter Druck wird als Duplikat gekennzeichnet', async () => {
    const rx = await h.issueRx(arzt);
    const first = await arzt.get(`/prescriptions/${rx.id}/pdf`).buffer(true).parse((res, cb) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(first.status).toBe(200);
    expect(first.headers['content-type']).toBe('application/pdf');
    const pdf1 = first.body.toString('latin1');
    expect(pdf1.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf1).toContain(rx.serial);
    expect(pdf1).toContain('Max Mustermann');
    expect(pdf1).not.toContain('DUPLIKAT');

    const second = await arzt.get(`/prescriptions/${rx.id}/pdf`).buffer(true).parse((res, cb) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(second.body.toString('latin1')).toContain('DUPLIKAT');
    expect((await arzt.get(`/prescriptions/${rx.id}`)).body.printCount).toBe(2);
  });

  test('Liste: Filter nach Status, Suche, abgelaufene Rezepte', async () => {
    const a = await h.issueRx(arzt, h.draftBody({ patient: { name: 'Anna Alpha', dob: '1990-01-01' } }));
    await h.issueRx(arzt, h.draftBody({ patient: { name: 'Berta Beta', dob: '1991-01-01' }, validityDays: 1 }));
    await arzt.post('/prescriptions').send(h.draftBody({ patient: { name: 'Carla Entwurf', dob: '1992-01-01' } }));
    await arzt.post(`/prescriptions/${a.id}/block`).send({ reason: 'ERROR' });

    expect((await arzt.get('/prescriptions')).body).toHaveLength(3);
    expect((await arzt.get('/prescriptions?state=DRAFT')).body.map((r) => r.patientName)).toEqual(['Carla Entwurf']);
    expect((await arzt.get('/prescriptions?state=BLOCKED')).body).toHaveLength(1);
    expect((await arzt.get('/prescriptions?q=berta')).body).toHaveLength(1);
    expect((await arzt.get('/prescriptions?q=PC-26')).body).toHaveLength(2); // nur ausgestellte haben eine Seriennummer
    expect((await arzt.get(`/prescriptions?q=${a.serial}`)).body).toHaveLength(1);
    expect((await arzt.get('/prescriptions?state=UNSINN')).status).toBe(400);

    h.clock.advance(2 * 24 * 3600 * 1000);
    arzt = await h.as('arzt@test.de'); // Sitzung (8 h) ist inzwischen abgelaufen
    expect((await arzt.get('/prescriptions?state=EXPIRED')).body.map((r) => r.patientName)).toEqual(['Berta Beta']);
    expect((await arzt.get('/prescriptions?state=ISSUED')).body).toHaveLength(0); // a gesperrt, b abgelaufen
    const expired = (await arzt.get('/prescriptions?state=EXPIRED')).body[0];
    expect((await arzt.get(`/prescriptions/${expired.id}/pdf`)).status).toBe(409);
  });

  test('Mandantentrennung: andere Praxis sieht, ändert, sperrt und druckt nichts', async () => {
    const rx = await h.issueRx(arzt);
    const fremd = await h.as('arzt-b@test.de');
    expect((await fremd.get(`/prescriptions/${rx.id}`)).status).toBe(404);
    expect((await fremd.get(`/prescriptions/${rx.serial}`)).status).toBe(404);
    expect((await fremd.post(`/prescriptions/${rx.id}/block`).send({ reason: 'ERROR' })).status).toBe(404);
    expect((await fremd.get(`/prescriptions/${rx.id}/pdf`)).status).toBe(404);
    expect((await fremd.get('/prescriptions')).body).toHaveLength(0);
    expect((await fremd.post('/prescriptions/block-bulk').send({ ids: [rx.id], reason: 'ERROR' })).body.blocked).toBe(0);
    expect((await arzt.get(`/prescriptions/${rx.id}`)).body.state).toBe('ISSUED');
  });

  test('Rollentrennung: Admins, Apotheke und QS sehen keine Rezeptinhalte', async () => {
    const rx = await h.issueRx(arzt);
    for (const email of ['praxisadmin@test.de', 'admin@test.de', 'qs@test.de', 'auditor@test.de', 'apotheker@test.de', 'apothekeadmin@test.de']) {
      const c = await h.as(email);
      expect((await c.get('/prescriptions')).status).toBe(403);
      expect((await c.get(`/prescriptions/${rx.id}`)).status).toBe(403);
    }
  });

  test('gesperrte Praxis kann nicht ausstellen, aber weiterhin sperren', async () => {
    const rx = await h.issueRx(arzt);
    const d = (await arzt.post('/prescriptions').send(h.draftBody())).body;
    await h.ctx.col('organizations').updateOne({ _id: s.practice._id }, { $set: { status: 'SUSPENDED' } });
    expect((await arzt.post(`/prescriptions/${d.id}/issue`).send({})).status).toBe(403);
    expect((await arzt.post(`/prescriptions/${rx.id}/block`).send({ reason: 'ERROR' })).status).toBe(200);
  });

  test('Audit: jede Aktion ist protokolliert, die Kette ist intakt, keine Gesundheitsdaten im Log', async () => {
    const rx = await h.issueRx(arzt);
    await arzt.post(`/prescriptions/${rx.id}/block`).send({ reason: 'ERROR' });
    const admin = await h.as('praxisadmin@test.de');
    const res = await admin.get('/audit?limit=100');
    const actions = res.body.entries.map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(['RX_DRAFT_CREATED', 'RX_ISSUED', 'RX_BLOCKED', 'LOGIN_SUCCESS']));
    expect(JSON.stringify(res.body)).not.toMatch(/Mustermann|Ibuprofen|1980/);
    expect((await admin.get('/audit/verify')).body).toMatchObject({ ok: true });
  });
});
