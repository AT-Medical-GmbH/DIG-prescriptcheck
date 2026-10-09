'use strict';

const { randomUUID, randomBytes } = require('crypto');
const { canonicalJson, sha256Hex } = require('../../lib/crypto');
const { generateSerial, parseSerial } = require('../../lib/ids');
const { encodeCode } = require('../../lib/rxCode');
const { STATES, effectiveState, canTransition } = require('../../lib/stateMachine');
const { renderPrescriptionPdf } = require('./rxPdf');
const v = require('../../lib/validate');
const { notFound, conflict, forbidden } = require('../../lib/errors');

const BLOCK_REASONS = ['LOSS', 'THEFT', 'ERROR', 'SUSPICION', 'OTHER'];


function parseDraft(body) {
  v.obj(body);
  const patient = v.obj(body.patient, 'patient');
  const items = v.array(body.items, 'items', { min: 1, max: 10 }).map((it, i) => {
    v.obj(it, `items[${i}]`);
    return {
      medication: v.str(it.medication, `items[${i}].medication`, { max: 200 }),
      form: v.str(it.form, `items[${i}].form`, { optional: true, max: 80 }),
      strength: v.str(it.strength, `items[${i}].strength`, { optional: true, max: 80 }),
      quantity: v.str(it.quantity, `items[${i}].quantity`, { max: 60 }),
      dosage: v.str(it.dosage, `items[${i}].dosage`, { optional: true, max: 300 }),
    };
  });
  return {
    content: {
      patient: { name: v.str(patient.name, 'patient.name', { max: 120 }), dob: v.birthDate(patient.dob, 'patient.dob') },
      items,
      note: v.str(body.note, 'note', { optional: true, max: 500 }),
    },
    validityDays: v.int(body.validityDays, 'validityDays', { min: 1, max: 90, optional: true }),
  };
}

function createPrescriptionService(ctx) {
  const rxs = ctx.col('prescriptions');
  const users = ctx.col('users');
  const orgs = ctx.col('organizations');
  const { vault } = ctx;

  const actorOf = (a) => ({ userId: a._id, role: a.role, orgId: a.orgId });
  const readContent = (rx) => vault.decryptJson(rx.practiceOrgId, rx.contentEnc);
  const writeContent = (orgId, content) => vault.encryptJson(orgId, content);

  async function findOwn(actor, idOrSerial) {
    let rx = await rxs.findOne({ _id: String(idOrSerial), practiceOrgId: actor.orgId });
    if (!rx) {
      const p = parseSerial(String(idOrSerial));
      if (p) rx = await rxs.findOne({ serial: p.serial, practiceOrgId: actor.orgId });
    }
    if (!rx) throw notFound('RX_NOT_FOUND', 'Rezept nicht gefunden.');
    return rx;
  }

  async function nameOf(map, col, id) {
    if (!id) return null;
    if (!map.has(id)) {
      const d = await col.findOne({ _id: id });
      map.set(id, d ? d.name : null);
    }
    return map.get(id);
  }

  async function present(rx, cache = { users: new Map(), orgs: new Map() }, { full = true } = {}) {
    const content = readContent(rx);
    const base = {
      id: rx._id,
      serial: rx.serial || null,
      state: effectiveState(rx, ctx.now()),
      storedState: rx.state,
      version: rx.version,
      patientName: content.patient.name,
      itemCount: content.items.length,
      firstItem: content.items[0].medication,
      createdAt: rx.createdAt,
      issuedAt: rx.issuedAt || null,
      expiresAt: rx.expiresAt || null,
      printCount: rx.printCount || 0,
      blockReason: rx.blockReason || null,
      blockedBy: rx.blockedBy || null,
      qsFlags: rx.qsFlags || [],
      redeemedAt: rx.redeemedAt || null,
    };
    if (!full) return base;
    return {
      ...base,
      patient: content.patient,
      items: content.items,
      note: content.note || null,
      validityDays: rx.validityDays || null,
      prescriberName: await nameOf(cache.users, users, rx.prescriberId || rx.createdBy),
      redeemedByPharmacy: rx.redeemedAt ? await nameOf(cache.orgs, orgs, rx.redeemedByOrgId) : null,
    };
  }

  async function createDraft(actor, body, meta = {}) {
    const { content, validityDays } = parseDraft(body);
    const rx = await rxs.insertOne({
      _id: randomUUID(), practiceOrgId: actor.orgId, createdBy: actor._id, state: STATES.DRAFT, version: 1,
      contentEnc: writeContent(actor.orgId, content), validityDays: validityDays || null,
      printCount: 0, createdAt: ctx.now(), updatedAt: ctx.now(),
    });
    await ctx.audit.record({ chains: [actor.orgId], actor: actorOf(actor), action: 'RX_DRAFT_CREATED', object: { type: 'prescription', id: rx._id }, ip: meta.ip, requestId: meta.requestId });
    return present(rx);
  }

  async function updateDraft(actor, id, body, meta = {}) {
    const rx = await findOwn(actor, id);
    if (rx.state !== STATES.DRAFT) throw conflict('NOT_A_DRAFT', 'Ausgestellte Rezepte sind unveränderlich. Bitte sperren und neu ausstellen.');
    const { content, validityDays } = parseDraft(body);
    const r = await rxs.updateOne({ _id: rx._id, state: STATES.DRAFT, version: rx.version }, {
      $set: { contentEnc: writeContent(actor.orgId, content), validityDays: validityDays || null, version: rx.version + 1, updatedAt: ctx.now() },
    });
    if (r.modifiedCount !== 1) throw conflict('CONFLICT', 'Das Rezept wurde zwischenzeitlich geändert.');
    await ctx.audit.record({ chains: [actor.orgId], actor: actorOf(actor), action: 'RX_DRAFT_UPDATED', object: { type: 'prescription', id: rx._id }, ip: meta.ip, requestId: meta.requestId });
    return present(await rxs.findOne({ _id: rx._id }));
  }

  async function discard(actor, id, meta = {}) {
    const rx = await findOwn(actor, id);
    const r = await rxs.updateOne({ _id: rx._id, state: STATES.DRAFT }, { $set: { state: STATES.DISCARDED, updatedAt: ctx.now(), version: rx.version + 1 } });
    if (r.modifiedCount !== 1) throw conflict('NOT_A_DRAFT', 'Nur Entwürfe können verworfen werden.');
    await ctx.audit.record({ chains: [actor.orgId], actor: actorOf(actor), action: 'RX_DISCARDED', object: { type: 'prescription', id: rx._id }, ip: meta.ip, requestId: meta.requestId });
    return { id: rx._id, state: STATES.DISCARDED };
  }

  /** Ausstellen: Seriennummer vergeben, Inhalt hashen, Code signieren, Rezept unveränderlich machen. */
  async function issue(actor, id, meta = {}) {
    const org = await orgs.findOne({ _id: actor.orgId });
    if (!org || org.status !== 'ACTIVE') throw forbidden('ORG_SUSPENDED', 'Die Praxis ist gesperrt. Ausstellung nicht möglich.');
    const rx = await findOwn(actor, id);
    if (rx.state !== STATES.DRAFT) throw conflict('NOT_A_DRAFT', 'Dieses Rezept ist bereits ausgestellt.');
    const content = readContent(rx);

    const iatSec = Math.floor(ctx.now() / 1000);
    const validityDays = rx.validityDays || ctx.config.rxValidityDays;
    const expSec = iatSec + validityDays * 24 * 3600;
    const issuedAt = iatSec * 1000;
    const expiresAt = expSec * 1000;

    for (let attempt = 0; attempt < 5; attempt++) {
      const { serial, raw } = generateSerial(issuedAt);
      const salt = randomBytes(16).toString('hex');
      const contentHash = sha256Hex(canonicalJson({ serial, practiceOrgId: rx.practiceOrgId, prescriberId: actor._id, issuedAt, expiresAt, salt, ...content }));
      const code = encodeCode({ kid: ctx.keyring.currentKid, iatSec, expSec, serialRaw: raw, hashHex: contentHash }, ctx.keyring);
      let r;
      try {
        r = await rxs.updateOne({ _id: rx._id, state: STATES.DRAFT, version: rx.version }, {
          $set: {
            state: STATES.ISSUED, serial, prescriberId: actor._id, issuedAt, expiresAt, salt, contentHash, code, kid: ctx.keyring.currentKid,
            dobMac: vault.dobMac(serial, content.patient.dob), failedDobAttempts: 0, dobLockedUntil: 0, qsFlags: [],
            version: rx.version + 1, updatedAt: ctx.now(),
          },
        });
      } catch (e) {
        if (e.code === 'DUPLICATE') continue; // Seriennummer-Kollision (äußerst unwahrscheinlich)
        throw e;
      }
      if (r.modifiedCount !== 1) throw conflict('CONFLICT', 'Das Rezept wurde zwischenzeitlich geändert.');
      await ctx.audit.record({ chains: [actor.orgId], actor: actorOf(actor), action: 'RX_ISSUED', object: { type: 'prescription', id: rx._id, serial }, detail: { expiresAt }, ip: meta.ip, requestId: meta.requestId });
      return present(await rxs.findOne({ _id: rx._id }));
    }
    throw new Error('Seriennummer konnte nicht vergeben werden');
  }

  async function block(actor, id, body, meta = {}) {
    const reason = v.oneOf(v.obj(body).reason, 'reason', BLOCK_REASONS);
    const rx = await findOwn(actor, id);
    if (!canTransition(rx.state, STATES.BLOCKED)) {
      throw conflict('NOT_BLOCKABLE', rx.state === STATES.REDEEMED ? 'Eingelöste Rezepte können nicht gesperrt werden.' : 'Dieses Rezept kann nicht gesperrt werden.');
    }
    const r = await rxs.updateOne({ _id: rx._id, state: STATES.ISSUED }, {
      $set: { state: STATES.BLOCKED, blockedBy: 'PRESCRIBER', blockReason: reason, blockedAt: ctx.now(), blockedByUserId: actor._id, version: rx.version + 1, updatedAt: ctx.now() },
    });
    if (r.modifiedCount !== 1) throw conflict('NOT_BLOCKABLE', 'Das Rezept wurde zwischenzeitlich eingelöst oder gesperrt.');
    await ctx.audit.record({ chains: [actor.orgId], actor: actorOf(actor), action: 'RX_BLOCKED', object: { type: 'prescription', id: rx._id, serial: rx.serial }, detail: { reason }, ip: meta.ip, requestId: meta.requestId });
    return present(await rxs.findOne({ _id: rx._id }));
  }

  async function blockMany(actor, body, meta = {}) {
    v.obj(body);
    const ids = v.array(body.ids, 'ids', { min: 1, max: 200 });
    const results = [];
    for (const id of ids) {
      try {
        const r = await block(actor, id, { reason: body.reason }, meta);
        results.push({ id, ok: true, state: r.state });
      } catch (e) {
        results.push({ id, ok: false, error: e.code || 'ERROR' });
      }
    }
    return { results, blocked: results.filter((r) => r.ok).length };
  }

  /** Notfallsperre: alle noch offenen, eigenen Rezepte der verordnenden Person (z. B. Verlust des Rezeptblocks). */
  async function blockAllOpen(actor, body, meta = {}) {
    const reason = v.oneOf(v.obj(body).reason, 'reason', BLOCK_REASONS);
    const open = await rxs.find({ practiceOrgId: actor.orgId, prescriberId: actor._id, state: STATES.ISSUED });
    let blocked = 0;
    for (const rx of open) {
      const r = await rxs.updateOne({ _id: rx._id, state: STATES.ISSUED }, {
        $set: { state: STATES.BLOCKED, blockedBy: 'PRESCRIBER', blockReason: reason, blockedAt: ctx.now(), blockedByUserId: actor._id, version: rx.version + 1, updatedAt: ctx.now() },
      });
      if (r.modifiedCount === 1) blocked++;
    }
    await ctx.audit.record({ chains: [actor.orgId], actor: actorOf(actor), action: 'RX_BLOCK_ALL_OPEN', detail: { reason, blocked }, ip: meta.ip, requestId: meta.requestId });
    return { blocked };
  }

  async function unblock(actor, id, body, meta = {}) {
    const reason = v.str(v.obj(body).reason, 'reason', { max: 300 });
    const rx = await findOwn(actor, id);
    if (rx.state !== STATES.BLOCKED) throw conflict('NOT_BLOCKED', 'Das Rezept ist nicht gesperrt.');
    if (rx.blockedBy !== 'PRESCRIBER') throw forbidden('QS_BLOCK', 'Diese Sperre wurde durch die Qualitätssicherung gesetzt und kann nur dort aufgehoben werden.');
    const r = await rxs.updateOne({ _id: rx._id, state: STATES.BLOCKED, blockedBy: 'PRESCRIBER' }, {
      $set: { state: STATES.ISSUED, blockedBy: null, blockReason: null, version: rx.version + 1, updatedAt: ctx.now() },
    });
    if (r.modifiedCount !== 1) throw conflict('CONFLICT', 'Das Rezept wurde zwischenzeitlich geändert.');
    await ctx.audit.record({ chains: [actor.orgId], actor: actorOf(actor), action: 'RX_UNBLOCKED', object: { type: 'prescription', id: rx._id, serial: rx.serial }, detail: { reason }, ip: meta.ip, requestId: meta.requestId });
    return present(await rxs.findOne({ _id: rx._id }));
  }

  async function get(actor, id) {
    return present(await findOwn(actor, id));
  }

  async function list(actor, { state, q, limit = 50 } = {}) {
    const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const filter = { practiceOrgId: actor.orgId };
    const wantExpired = state === 'EXPIRED';
    if (state && !wantExpired) {
      v.oneOf(state, 'state', Object.values(STATES));
      filter.state = state;
    } else if (wantExpired) {
      filter.state = STATES.ISSUED;
    }
    const rows = await rxs.find(filter, { sort: { createdAt: -1 }, limit: 500 });
    const cache = { users: new Map(), orgs: new Map() };
    const needle = (q || '').trim().toLowerCase();
    const out = [];
    for (const rx of rows) {
      const p = await present(rx, cache, { full: false });
      if (state === STATES.ISSUED && p.state !== STATES.ISSUED) continue; // abgelaufene nicht als "gültig" listen
      if (wantExpired && p.state !== STATES.EXPIRED) continue;
      if (needle && !(`${p.serial || ''} ${p.patientName}`.toLowerCase().includes(needle))) continue;
      out.push(p);
      if (out.length >= lim) break;
    }
    return out;
  }

  async function renderPdf(actor, id, meta = {}) {
    const rx = await findOwn(actor, id);
    if (effectiveState(rx, ctx.now()) !== STATES.ISSUED) throw conflict('NOT_PRINTABLE', 'Nur gültige, ausgestellte Rezepte können gedruckt werden.');
    const content = readContent(rx);
    const org = await orgs.findOne({ _id: rx.practiceOrgId });
    const prescriber = await users.findOne({ _id: rx.prescriberId });
    const duplicate = (rx.printCount || 0) > 0;
    await rxs.updateOne({ _id: rx._id, state: STATES.ISSUED }, { $inc: { printCount: 1 } });
    await ctx.audit.record({ chains: [actor.orgId], actor: actorOf(actor), action: 'RX_PRINTED', object: { type: 'prescription', id: rx._id, serial: rx.serial }, detail: { printNo: (rx.printCount || 0) + 1 }, ip: meta.ip, requestId: meta.requestId });

    return { pdf: renderPrescriptionPdf({ rx, content, org, prescriber, printNo: (rx.printCount || 0) + 1 }), serial: rx.serial };
  }

  return { createDraft, updateDraft, discard, issue, block, blockMany, blockAllOpen, unblock, get, list, renderPdf };
}

module.exports = { createPrescriptionService, BLOCK_REASONS };
