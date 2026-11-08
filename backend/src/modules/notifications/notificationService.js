'use strict';

/** In-App-Benachrichtigungen je Organisation. Enthalten nie Gesundheitsdaten. */
function createNotificationService(ctx) {
  const col = ctx.col('notifications');

  async function create(orgId, { type, serial = null, message }) {
    return col.insertOne({ orgId, type, serial, message, read: false, createdAt: ctx.now() });
  }

  async function list(orgId, { limit = 50 } = {}) {
    const rows = await col.find({ orgId }, { sort: { createdAt: -1 }, limit: Math.min(Number(limit) || 50, 200) });
    return rows.map((n) => ({ id: n._id, type: n.type, serial: n.serial, message: n.message, read: n.read, createdAt: n.createdAt }));
  }

  async function markAllRead(orgId) {
    const unread = await col.find({ orgId, read: false });
    for (const n of unread) await col.updateOne({ _id: n._id }, { $set: { read: true } });
    return { updated: unread.length };
  }

  return { create, list, markAllRead };
}

module.exports = { createNotificationService };
