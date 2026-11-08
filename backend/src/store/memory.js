'use strict';

const { randomUUID } = require('crypto');
const { AppError } = require('../lib/errors');
const { COLLECTIONS } = require('./schema');

/**
 * Speicher-Store für Entwicklung, Tests und Demos. Gleiche Schnittstelle wie der
 * MongoDB-Store (siehe store.contract.js). Alle Operationen laufen synchron im
 * Event-Loop und sind damit atomar.
 */

const clone = (v) => (v === undefined ? v : structuredClone(v));
const isOps = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).some((k) => k.startsWith('$'));

function matchValue(actual, cond) {
  const a = actual === undefined ? null : actual;
  if (!isOps(cond)) return a === (cond === undefined ? null : cond);
  return Object.entries(cond).every(([op, val]) => {
    switch (op) {
      case '$in': return val.includes(a);
      case '$ne': return a !== val;
      case '$gt': return a !== null && a > val;
      case '$gte': return a !== null && a >= val;
      case '$lt': return a !== null && a < val;
      case '$lte': return a !== null && a <= val;
      default: throw new Error(`Operator nicht unterstützt: ${op}`);
    }
  });
}

const matches = (doc, filter) => Object.entries(filter).every(([k, cond]) => matchValue(doc[k], cond));

class MemoryCollection {
  constructor(name) {
    this.name = name;
    this.docs = new Map();
    const def = COLLECTIONS[name] || { unique: [] };
    this.unique = def.unique;
    this.sparse = !!def.sparseUnique;
  }

  checkUnique(doc, ignoreId) {
    for (const fields of this.unique) {
      if (this.sparse && fields.some((f) => doc[f] === undefined || doc[f] === null)) continue;
      for (const other of this.docs.values()) {
        if (other._id !== ignoreId && fields.every((f) => other[f] === doc[f])) {
          throw new AppError(409, 'DUPLICATE', `Eindeutigkeit verletzt: ${fields.join(',')}`);
        }
      }
    }
  }

  async insertOne(doc) {
    const d = clone(doc);
    if (d._id === undefined) d._id = randomUUID();
    if (this.docs.has(d._id)) throw new AppError(409, 'DUPLICATE', 'Eindeutigkeit verletzt: _id');
    this.checkUnique(d);
    this.docs.set(d._id, d);
    return clone(d);
  }

  async findOne(filter = {}) {
    for (const d of this.docs.values()) if (matches(d, filter)) return clone(d);
    return null;
  }

  async find(filter = {}, { sort, limit, skip = 0 } = {}) {
    let res = [...this.docs.values()].filter((d) => matches(d, filter));
    if (sort) {
      const [[key, dir]] = Object.entries(sort);
      res.sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * dir);
    }
    res = res.slice(skip, limit ? skip + limit : undefined);
    return res.map(clone);
  }

  async countDocuments(filter = {}) {
    return [...this.docs.values()].filter((d) => matches(d, filter)).length;
  }

  /** Aktualisiert das erste passende Dokument atomar. */
  async updateOne(filter, update) {
    for (const d of this.docs.values()) {
      if (!matches(d, filter)) continue;
      const next = clone(d);
      for (const [k, v] of Object.entries(update.$set || {})) next[k] = clone(v);
      for (const [k, v] of Object.entries(update.$inc || {})) next[k] = (next[k] || 0) + v;
      for (const [k, v] of Object.entries(update.$push || {})) next[k] = [...(next[k] || []), clone(v)];
      this.checkUnique(next, d._id);
      this.docs.set(d._id, next);
      return { matchedCount: 1, modifiedCount: 1 };
    }
    return { matchedCount: 0, modifiedCount: 0 };
  }
}

class MemoryStore {
  constructor() {
    this.cols = new Map();
  }

  collection(name) {
    if (!this.cols.has(name)) this.cols.set(name, new MemoryCollection(name));
    return this.cols.get(name);
  }

  async init() {}

  async ping() {
    return true;
  }

  async close() {}
}

module.exports = { MemoryStore };
