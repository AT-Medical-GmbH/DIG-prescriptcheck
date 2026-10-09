'use strict';

const { MemoryStore } = require('./memory');
const { createVault } = require('../lib/crypto');
const { AuditLog } = require('../modules/audit/audit');
const crypto = require('crypto');

/**
 * Vertragstest für Store-Implementierungen. Läuft immer gegen den Speicher-Store und,
 * wenn MONGODB_URI_TEST gesetzt ist, zusätzlich gegen MongoDB (leere Test-Datenbank!).
 */
const targets = [['MemoryStore', async () => new MemoryStore()]];
if (process.env.MONGODB_URI_TEST) {
  targets.push([
    'MongoStore',
    async () => {
      const { MongoStore } = require('./mongo');
      const s = new MongoStore(process.env.MONGODB_URI_TEST);
      await s.connect();
      await s.db.dropDatabase();
      await s.init();
      return s;
    },
  ]);
}

describe.each(targets)('Store-Vertrag: %s', (_name, make) => {
  let store;
  beforeEach(async () => {
    store = await make();
    await store.init();
  });
  afterEach(async () => store.close());

  test('insert/findOne/find mit Operatoren, Sortierung und Limit', async () => {
    const c = store.collection('notifications');
    for (let i = 1; i <= 5; i++) await c.insertOne({ orgId: 'o', n: i, read: i % 2 === 0, createdAt: i });
    expect((await c.findOne({ n: 3 })).n).toBe(3);
    expect(await c.findOne({ n: 99 })).toBeNull();
    expect((await c.find({ n: { $in: [1, 2] } })).length).toBe(2);
    expect((await c.find({ n: { $gt: 2, $lte: 4 } })).map((d) => d.n).sort()).toEqual([3, 4]);
    expect((await c.find({ orgId: 'o' }, { sort: { createdAt: -1 }, limit: 2 })).map((d) => d.n)).toEqual([5, 4]);
    expect(await c.countDocuments({ read: true })).toBe(2);
    expect((await c.find({ read: { $ne: true } })).length).toBe(3);
  });

  test('Eindeutigkeit wird als DUPLICATE gemeldet', async () => {
    const u = store.collection('users');
    await u.insertOne({ email: 'a@x.de' });
    await expect(u.insertOne({ email: 'a@x.de' })).rejects.toMatchObject({ code: 'DUPLICATE' });
  });

  test('Eindeutigkeit der Seriennummer gilt nur für gesetzte Werte (Entwürfe ohne Seriennummer)', async () => {
    const c = store.collection('prescriptions');
    await c.insertOne({ practiceOrgId: 'o', state: 'DRAFT' });
    await c.insertOne({ practiceOrgId: 'o', state: 'DRAFT' });
    await c.insertOne({ serial: 'S1' });
    await expect(c.insertOne({ serial: 'S1' })).rejects.toMatchObject({ code: 'DUPLICATE' });
  });

  test('updateOne ist bedingt: $set, $inc, $push', async () => {
    const c = store.collection('prescriptions');
    const d = await c.insertOne({ serial: 'A', state: 'ISSUED', n: 0 });
    expect((await c.updateOne({ _id: d._id, state: 'BLOCKED' }, { $set: { n: 5 } })).modifiedCount).toBe(0);
    expect((await c.updateOne({ _id: d._id, state: 'ISSUED' }, { $set: { state: 'REDEEMED' }, $inc: { n: 2 }, $push: { flags: 'x' } })).modifiedCount).toBe(1);
    const after = await c.findOne({ _id: d._id });
    expect(after).toMatchObject({ state: 'REDEEMED', n: 2, flags: ['x'] });
  });

  test('parallele bedingte Updates: genau einer gewinnt', async () => {
    const c = store.collection('prescriptions');
    const d = await c.insertOne({ serial: 'RACE', state: 'ISSUED' });
    const results = await Promise.all(Array.from({ length: 25 }, () => c.updateOne({ _id: d._id, state: 'ISSUED' }, { $set: { state: 'REDEEMED' } })));
    expect(results.filter((r) => r.modifiedCount === 1)).toHaveLength(1);
  });

  test('Audit-Kette: Reihenfolge, Verifikation, Manipulationserkennung, Parallelität', async () => {
    const vault = createVault(crypto.randomBytes(32));
    const audit = new AuditLog({ store, vault });
    await Promise.all(Array.from({ length: 20 }, (_, i) => audit.record({ chains: ['org1'], actor: { userId: `u${i}` }, action: 'TEST', detail: { i } })));
    const list = await audit.list('org1', { limit: 100 });
    expect(list.map((e) => e.seq)).toEqual(Array.from({ length: 20 }, (_, i) => 20 - i));
    expect(await audit.verify('org1')).toEqual({ ok: true, count: 20 });
    expect(await audit.verify('leer')).toEqual({ ok: true, count: 0 });

    // Manipulation: Inhalt ändern → Hash passt nicht mehr
    await store.collection('audit').updateOne({ _id: 'org1:7' }, { $set: { action: 'MANIPULIERT' } });
    expect(await audit.verify('org1')).toMatchObject({ ok: false, brokenAt: 7, reason: 'HASH' });
  });

  test('Audit-Kette erkennt gelöschte Einträge und abgeschnittene Enden', async () => {
    const vault = createVault(crypto.randomBytes(32));
    const audit = new AuditLog({ store, vault });
    for (let i = 0; i < 5; i++) await audit.record({ chains: ['c'], action: 'T' });
    // Kettenkopf zurückdrehen simuliert abgeschnittene Einträge
    await store.collection('audit_heads').updateOne({ _id: 'c' }, { $set: { seq: 4 } });
    expect(await audit.verify('c')).toMatchObject({ ok: false, reason: 'KETTENKOPF' });
  });

  test('Eintrag in mehrere Ketten, undefined-Felder beeinflussen den Hash nicht', async () => {
    const vault = createVault(crypto.randomBytes(32));
    const audit = new AuditLog({ store, vault });
    await audit.record({ chains: ['a', 'b', 'a', null], actor: { userId: 'u', orgId: undefined }, action: 'X', detail: { y: undefined } });
    expect((await audit.verify('a')).ok).toBe(true);
    expect((await audit.verify('b')).ok).toBe(true);
    expect((await audit.list('a')).length).toBe(1);
  });
});
