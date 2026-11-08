const tz = 'Europe/Berlin';

export const fmtDate = (ms) => (ms ? new Date(ms).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: tz }) : '–');
export const fmtDateTime = (ms) => (ms ? new Date(ms).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: tz }) : '–');

/** "17.05.1980", "17.5.1980" oder "1980-05-17" → "1980-05-17" (sonst null). */
export function parseDob(input) {
  const s = String(input || '').trim();
  let y; let m; let d;
  let match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
  if (match) [, d, m, y] = match;
  else if ((match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s))) [, y, m, d] = match;
  else return null;
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}

export const STATE_LABELS = {
  DRAFT: 'Entwurf', ISSUED: 'Gültig', BLOCKED: 'Gesperrt', REDEEMED: 'Eingelöst', EXPIRED: 'Abgelaufen', DISCARDED: 'Verworfen',
};
export const BLOCK_REASON_LABELS = { LOSS: 'Verlust', THEFT: 'Diebstahl', ERROR: 'Fehler im Rezept', SUSPICION: 'Verdacht', OTHER: 'Sonstiges' };
export const ROLE_LABELS = {
  PLATFORM_ADMIN: 'Plattform-Administration', SUPERVISOR: 'QS-Supervisor', AUDITOR: 'Auditor', PRACTICE_ADMIN: 'Praxis-Administration',
  PRESCRIBER: 'Verordnende Person', PRACTICE_STAFF: 'Praxispersonal', PHARMACY_ADMIN: 'Apotheken-Administration', PHARMACIST: 'Apotheker/in', PHARMACY_STAFF: 'Apothekenpersonal',
};
