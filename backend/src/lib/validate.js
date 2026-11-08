'use strict';

const { badRequest } = require('./errors');

/**
 * Kleine, abhängigkeitsfreie Eingabevalidierung. Jede Funktion gibt den
 * bereinigten Wert zurück oder wirft einen 400er-Fehler mit Feldbezug.
 */

const fail = (field, msg) => badRequest('VALIDATION_ERROR', `${field}: ${msg}`, { field });

function obj(value, field = 'Body') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw fail(field, 'Objekt erwartet');
  return value;
}

function str(value, field, { min = 1, max = 200, optional = false, pattern } = {}) {
  if (value === undefined || value === null || value === '') {
    if (optional) return undefined;
    throw fail(field, 'Pflichtfeld');
  }
  if (typeof value !== 'string') throw fail(field, 'Text erwartet');
  const v = value.trim().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
  if (v.length < min) throw fail(field, `mindestens ${min} Zeichen`);
  if (v.length > max) throw fail(field, `höchstens ${max} Zeichen`);
  if (pattern && !pattern.test(v)) throw fail(field, 'ungültiges Format');
  return v;
}

function oneOf(value, field, allowed, { optional = false } = {}) {
  if ((value === undefined || value === null) && optional) return undefined;
  if (!allowed.includes(value)) throw fail(field, `erlaubt sind: ${allowed.join(', ')}`);
  return value;
}

function int(value, field, { min = 0, max = 1e9, optional = false } = {}) {
  if ((value === undefined || value === null) && optional) return undefined;
  if (!Number.isInteger(value) || value < min || value > max) throw fail(field, `ganze Zahl ${min}..${max} erwartet`);
  return value;
}

/** ISO-Datum YYYY-MM-DD, existierend und nicht in der Zukunft. */
function birthDate(value, field = 'Geburtsdatum', now = new Date()) {
  const v = str(value, field, { min: 10, max: 10, pattern: /^\d{4}-\d{2}-\d{2}$/ });
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) throw fail(field, 'kein gültiges Datum');
  if (d.getTime() > now.getTime()) throw fail(field, 'liegt in der Zukunft');
  if (d.getUTCFullYear() < 1890) throw fail(field, 'unplausibel');
  return v;
}

const email = (value, field = 'E-Mail') =>
  str(value, field, { max: 200, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/ }).toLowerCase();

function array(value, field, { min = 0, max = 100 } = {}) {
  if (!Array.isArray(value)) throw fail(field, 'Liste erwartet');
  if (value.length < min) throw fail(field, `mindestens ${min} Einträge`);
  if (value.length > max) throw fail(field, `höchstens ${max} Einträge`);
  return value;
}

module.exports = { obj, str, oneOf, int, birthDate, email, array, fail };
