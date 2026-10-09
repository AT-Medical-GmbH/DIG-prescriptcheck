'use strict';

const { AppError } = require('../lib/errors');

function notFoundHandler(req, _res, next) {
  next(new AppError(404, 'NOT_FOUND', 'Endpunkt nicht gefunden.'));
}

/** Einheitliches Fehlerformat; interne Fehler werden nie mit Details an Clients gegeben. */
function createErrorHandler(log) {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, _next) => {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) }, requestId: req.id });
    }
    if (err && (err.type === 'entity.parse.failed' || err.type === 'entity.too.large')) {
      const tooLarge = err.type === 'entity.too.large';
      return res.status(tooLarge ? 413 : 400).json({ error: { code: tooLarge ? 'PAYLOAD_TOO_LARGE' : 'INVALID_JSON', message: tooLarge ? 'Anfrage zu groß.' : 'Ungültiges JSON.' }, requestId: req.id });
    }
    log.error('Unerwarteter Fehler', { requestId: req.id, path: req.path, method: req.method, error: err && err.message, stack: err && err.stack });
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Interner Fehler.' }, requestId: req.id });
  };
}

module.exports = { notFoundHandler, createErrorHandler };
