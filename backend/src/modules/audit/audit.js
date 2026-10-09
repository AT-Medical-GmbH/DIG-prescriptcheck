'use strict';

const { canonicalJson } = require('../../lib/crypto');

/**
 * Manipulationsgeschütztes Audit-Log (Konzept 9.6):
 *  - append-only je Kette (Mandant bzw. "platform")
 *  - jeder Eintrag enthält den Hash des Vorgängers; der Hash ist ein HMAC über den
 *    kanonischen Eintrag → Änderung/Löschung/Umsortierung ist nachweisbar
 *  - Fortschreibung über bedingtes Update des Kettenkopfs (auch bei Parallelität sicher)
 * Einträge enthalten keine Gesundheitsdaten (nur IDs, Seriennummern, Ergebniscodes).
 */

const GENESIS = 'GENESIS';
const MAX_RETRIES = 12;

class AuditLog {
  constructor({ store, vault, now = () => Date.now() }) {
    this.entries = store.collection('audit');
    this.heads = store.collection('audit_heads');
    this.vault = vault;
    this.now = now;
    this.queues = new Map();
  }

  /**
   * @param {object} e
   * @param {string[]} e.chains   Ketten, in die der Eintrag geschrieben wird (z. B. Apotheke + Praxis)
   * @param {{userId?:string, role?:string, orgId?:string}} [e.actor]
   * @param {string} e.action
   * @param {{type?:string, id?:string, serial?:string}} [e.object]
   * @param {'OK'|'DENIED'|'FAIL'} [e.result]
   * @param {object} [e.detail]   nur technische Metadaten, keine Gesundheitsdaten
   */
  async record({ chains, actor = {}, action, object = {}, result = 'OK', detail = {}, ip = null, requestId = null }) {
    const unique = [...new Set(chains.filter(Boolean))];
    for (const chain of unique) {
      await this.append(chain, { actor, action, object, result, detail, ip, requestId });
    }
  }

  /**
   * Schreibzugriffe auf dieselbe Kette laufen im Prozess nacheinander (kein Konkurrieren um
   * den Kettenkopf). Zwischen mehreren Instanzen sichert das bedingte Update den Kettenkopf ab.
   */
  append(chain, payload) {
    const previous = this.queues.get(chain) || Promise.resolve();
    const run = previous.catch(() => {}).then(() => this.appendUnqueued(chain, payload));
    this.queues.set(chain, run);
    run.finally(() => {
      if (this.queues.get(chain) === run) this.queues.delete(chain);
    }).catch(() => {});
    return run;
  }

  async appendUnqueued(chain, payload) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, Math.random() * 10 * attempt));
      let head = await this.heads.findOne({ _id: chain });
      if (!head) {
        try {
          head = await this.heads.insertOne({ _id: chain, seq: 0, hash: GENESIS });
        } catch (e) {
          if (e.code !== 'DUPLICATE') throw e;
          continue;
        }
      }
      // JSON-Rundlauf entfernt undefined-Felder, damit der Hash unabhängig vom Store reproduzierbar ist
      const body = JSON.parse(JSON.stringify({ chain, seq: head.seq + 1, ts: this.now(), ...payload, prevHash: head.hash }));
      const hash = this.vault.auditHmac(canonicalJson(body));
      const claimed = await this.heads.updateOne({ _id: chain, seq: head.seq }, { $set: { seq: body.seq, hash } });
      if (claimed.modifiedCount === 1) {
        await this.entries.insertOne({ _id: `${chain}:${body.seq}`, ...body, hash });
        return;
      }
    }
    throw new Error('Audit-Eintrag konnte nicht geschrieben werden (Konflikte)');
  }

  async list(chain, { limit = 50, beforeSeq } = {}) {
    const filter = { chain };
    if (beforeSeq) filter.seq = { $lt: beforeSeq };
    const rows = await this.entries.find(filter, { sort: { seq: -1 }, limit });
    return rows.map(({ _id, ...rest }) => rest);
  }

  /** Prüft die Kette von Anfang bis Ende. */
  async verify(chain) {
    const rows = await this.entries.find({ chain }, { sort: { seq: 1 } });
    let prev = GENESIS;
    let expectedSeq = 1;
    for (const row of rows) {
      const { _id, hash, ...body } = row;
      if (body.seq !== expectedSeq) return { ok: false, count: rows.length, brokenAt: expectedSeq, reason: 'LUECKE' };
      if (body.prevHash !== prev) return { ok: false, count: rows.length, brokenAt: body.seq, reason: 'VORGAENGER' };
      if (this.vault.auditHmac(canonicalJson(body)) !== hash) return { ok: false, count: rows.length, brokenAt: body.seq, reason: 'HASH' };
      prev = hash;
      expectedSeq++;
    }
    const head = await this.heads.findOne({ _id: chain });
    if (head && (head.seq !== rows.length || (rows.length && head.hash !== prev))) {
      return { ok: false, count: rows.length, brokenAt: rows.length + 1, reason: 'KETTENKOPF' };
    }
    return { ok: true, count: rows.length };
  }
}

module.exports = { AuditLog, GENESIS };
