'use strict';

const { STATES, effectiveState } = require('../../lib/stateMachine');
const { parseSerial } = require('../../lib/ids');
const v = require('../../lib/validate');
const { badRequest, conflict, notFound } = require('../../lib/errors');

/**
 * Qualitätssicherung (Supervisor). Arbeitet ausschließlich mit Metadaten –
 * Rezeptinhalte und Patientendaten sind für die QS nicht sichtbar.
 */
function createQsService(ctx, notifications) {
  const rxs = ctx.col('prescriptions');
  const orgs = ctx.col('organizations');

  async function listFlagged() {
    const blocked = await rxs.find({ blockedBy: 'QS', state: STATES.BLOCKED }, { sort: { blockedAt: -1 }, limit: 200 });
    const issued = await rxs.find({ state: STATES.ISSUED }, { sort: { createdAt: -1 }, limit: 500 });
    const flaggedOpen = issued.filter((r) => (r.qsFlags || []).length > 0);
    const cache = new Map();
    const orgName = async (id) => {
      if (!cache.has(id)) cache.set(id, (await orgs.findOne({ _id: id }))?.name || null);
      return cache.get(id);
    };
    const rows = [];
    for (const rx of [...blocked, ...flaggedOpen]) {
      rows.push({
        serial: rx.serial, practiceName: await orgName(rx.practiceOrgId), state: effectiveState(rx, ctx.now()), blockedBy: rx.blockedBy || null,
        blockedAt: rx.blockedAt || null, flags: (rx.qsFlags || []).map((f) => ({ type: f.type, category: f.category || null, at: f.at })),
      });
    }
    return rows;
  }

  async function unblock(actor, serialInput, body, meta = {}) {
    const parsed = parseSerial(serialInput);
    if (!parsed) throw badRequest('SERIAL_INVALID', 'Ungültige Rezept-ID.');
    const reason = v.str(v.obj(body).reason, 'reason', { max: 300 });
    const rx = await rxs.findOne({ serial: parsed.serial });
    if (!rx) throw notFound('RX_NOT_FOUND', 'Rezept nicht gefunden.');
    if (rx.state !== STATES.BLOCKED || rx.blockedBy !== 'QS') throw conflict('NOT_QS_BLOCKED', 'Das Rezept ist nicht durch die QS gesperrt.');
    const r = await rxs.updateOne({ _id: rx._id, state: STATES.BLOCKED, blockedBy: 'QS' }, {
      $set: { state: STATES.ISSUED, blockedBy: null, blockReason: null, qsFlags: [], updatedAt: ctx.now() },
      $inc: { version: 1 },
    });
    if (r.modifiedCount !== 1) throw conflict('CONFLICT', 'Das Rezept wurde zwischenzeitlich geändert.');
    await ctx.audit.record({ chains: ['platform', rx.practiceOrgId], actor: { userId: actor._id, role: actor.role }, action: 'QS_UNBLOCKED', object: { type: 'prescription', id: rx._id, serial: rx.serial }, detail: { reason }, ip: meta.ip, requestId: meta.requestId });
    await notifications.create(rx.practiceOrgId, { type: 'QS_UNBLOCKED', serial: rx.serial, message: `Die QS hat die Sperre von Rezept ${rx.serial} aufgehoben.` });
    return { serial: rx.serial, state: STATES.ISSUED };
  }

  return { listFlagged, unblock };
}

module.exports = { createQsService };
