'use strict';

/**
 * Fachlicher/HTTP-Fehler. `code` ist ein stabiler, maschinenlesbarer Fehlercode,
 * `message` eine für Anwender geeignete Meldung ohne Gesundheitsdaten.
 */
class AppError extends Error {
  constructor(status, code, message, details) {
    super(message || code);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const badRequest = (code, message, details) => new AppError(400, code, message, details);
const unauthorized = (code = 'UNAUTHORIZED', message = 'Nicht angemeldet.') => new AppError(401, code, message);
const forbidden = (code = 'FORBIDDEN', message = 'Keine Berechtigung.') => new AppError(403, code, message);
const notFound = (code = 'NOT_FOUND', message = 'Nicht gefunden.') => new AppError(404, code, message);
const conflict = (code, message) => new AppError(409, code, message);
const tooMany = (code = 'TOO_MANY_REQUESTS', message = 'Zu viele Anfragen.') => new AppError(429, code, message);

module.exports = { AppError, badRequest, unauthorized, forbidden, notFound, conflict, tooMany };
