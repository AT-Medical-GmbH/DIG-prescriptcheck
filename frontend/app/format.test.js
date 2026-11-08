import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDob, fmtDate, STATE_LABELS } from './format.js';

test('parseDob akzeptiert deutsche und ISO-Schreibweise', () => {
  assert.equal(parseDob('17.05.1980'), '1980-05-17');
  assert.equal(parseDob('7.5.1980'), '1980-05-07');
  assert.equal(parseDob(' 1980-05-17 '), '1980-05-17');
});

test('parseDob lehnt ungültige Daten ab', () => {
  for (const bad of ['', null, undefined, '30.02.1980', '1980-13-01', '17/05/1980', 'abc', '17.05.80', '32.01.2000']) {
    assert.equal(parseDob(bad), null, String(bad));
  }
});

test('Datumsformat in deutscher Zeitzone', () => {
  assert.equal(fmtDate(Date.UTC(2026, 9, 9, 23, 30)), '10.10.2026'); // 01:30 Uhr MESZ am Folgetag
  assert.equal(fmtDate(null), '–');
});

test('alle Rezeptzustände haben eine Beschriftung', () => {
  for (const s of ['DRAFT', 'ISSUED', 'BLOCKED', 'REDEEMED', 'EXPIRED', 'DISCARDED']) assert.ok(STATE_LABELS[s], s);
});
