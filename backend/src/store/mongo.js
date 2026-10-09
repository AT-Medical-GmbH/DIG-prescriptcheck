'use strict';

const mongoose = require('mongoose');
const { AppError } = require('../lib/errors');
const { COLLECTIONS } = require('./schema');

/**
 * MongoDB-Store über den nativen Treiber von mongoose. Dünne Schicht mit derselben
 * Schnittstelle wie der Speicher-Store; Fachlogik kennt weder mongoose noch BSON.
 * Atomare Zustandsübergänge laufen über bedingte updateOne-Aufrufe.
 */

const mapError = (err) => {
  if (err && err.code === 11000) throw new AppError(409, 'DUPLICATE', 'Eindeutigkeit verletzt');
  throw err;
};

class MongoCollection {
  constructor(col) {
    this.col = col;
  }

  async insertOne(doc) {
    const d = { ...doc };
    if (d._id === undefined) d._id = require('crypto').randomUUID();
    try {
      await this.col.insertOne(d);
    } catch (e) {
      mapError(e);
    }
    return d;
  }

  findOne(filter = {}) {
    return this.col.findOne(filter);
  }

  find(filter = {}, { sort, limit, skip } = {}) {
    let cur = this.col.find(filter);
    if (sort) cur = cur.sort(sort);
    if (skip) cur = cur.skip(skip);
    if (limit) cur = cur.limit(limit);
    return cur.toArray();
  }

  countDocuments(filter = {}) {
    return this.col.countDocuments(filter);
  }

  async updateOne(filter, update) {
    try {
      const r = await this.col.updateOne(filter, update);
      return { matchedCount: r.matchedCount, modifiedCount: r.modifiedCount };
    } catch (e) {
      return mapError(e);
    }
  }
}

class MongoStore {
  constructor(uri) {
    this.uri = uri;
    this.cols = new Map();
  }

  async connect() {
    await mongoose.connect(this.uri, { serverSelectionTimeoutMS: 8000 });
    this.db = mongoose.connection.db;
  }

  collection(name) {
    if (!this.cols.has(name)) this.cols.set(name, new MongoCollection(this.db.collection(name)));
    return this.cols.get(name);
  }

  async init() {
    for (const [name, def] of Object.entries(COLLECTIONS)) {
      const col = this.db.collection(name);
      const toSpec = (fields) => Object.fromEntries(fields.map((f) => [f, 1]));
      for (const fields of def.unique) {
        const opts = { unique: true };
        if (def.sparseUnique) opts.partialFilterExpression = Object.fromEntries(fields.map((f) => [f, { $type: 'string' }]));
        await col.createIndex(toSpec(fields), opts);
      }
      for (const fields of def.indexes) await col.createIndex(toSpec(fields));
    }
  }

  async ping() {
    await this.db.command({ ping: 1 });
    return true;
  }

  async close() {
    await mongoose.disconnect();
  }
}

module.exports = { MongoStore };
