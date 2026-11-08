'use strict';

/**
 * Rezeptlebenszyklus (Konzept 6.2). Persistierte Zustände:
 *   DRAFT, ISSUED, BLOCKED, REDEEMED, DISCARDED
 * "Gültig" und "abgelaufen" sind abgeleitet: ISSUED + Ablaufzeit.
 */

const STATES = Object.freeze({
  DRAFT: 'DRAFT',
  ISSUED: 'ISSUED',
  BLOCKED: 'BLOCKED',
  REDEEMED: 'REDEEMED',
  DISCARDED: 'DISCARDED',
  EXPIRED: 'EXPIRED', // nur abgeleitet, nie gespeichert
});

const TRANSITIONS = {
  DRAFT: ['ISSUED', 'DISCARDED'],
  ISSUED: ['BLOCKED', 'REDEEMED'],
  BLOCKED: ['ISSUED'],
  REDEEMED: ['ISSUED'], // nur Einlösestorno innerhalb der Frist
  DISCARDED: [],
};

const canTransition = (from, to) => (TRANSITIONS[from] || []).includes(to);

/** Zustand unter Berücksichtigung des Ablaufs. */
function effectiveState(rx, nowMs = Date.now()) {
  if (rx.state === STATES.ISSUED && rx.expiresAt != null && nowMs >= rx.expiresAt) return STATES.EXPIRED;
  return rx.state;
}

module.exports = { STATES, TRANSITIONS, canTransition, effectiveState };
