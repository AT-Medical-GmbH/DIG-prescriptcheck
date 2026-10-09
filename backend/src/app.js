'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { randomUUID } = require('crypto');
const { createRouter } = require('./routes');
const { notFoundHandler, createErrorHandler } = require('./middleware/errorHandler');

/**
 * Express-App. Antworten enthalten potenziell Gesundheitsdaten und werden daher nie gecacht.
 */
function createApp(ctx) {
  const app = express();
  app.disable('x-powered-by');
  if (ctx.config.trustProxy) app.set('trust proxy', ctx.config.trustProxy);

  app.use((req, res, next) => {
    req.id = req.headers['x-request-id'] && /^[\w-]{8,64}$/.test(req.headers['x-request-id']) ? req.headers['x-request-id'] : randomUUID();
    res.set('X-Request-Id', req.id);
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(helmet());
  if (ctx.config.corsOrigins.length) {
    app.use(cors({ origin: ctx.config.corsOrigins, methods: ['GET', 'POST', 'PUT', 'PATCH'], allowedHeaders: ['Content-Type', 'Authorization'], maxAge: 600 }));
  }
  app.use(express.json({ limit: '100kb' }));

  // schlankes Zugriffslog ohne Query-String und ohne Nutzdaten
  app.use((req, res, next) => {
    const t0 = process.hrtime.bigint();
    res.on('finish', () => {
      ctx.log.info('http', { requestId: req.id, method: req.method, path: req.path, status: res.statusCode, ms: Number((process.hrtime.bigint() - t0) / 1000000n) });
    });
    next();
  });

  app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));
  app.get('/readyz', async (_req, res) => {
    try {
      await ctx.store.ping();
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });
  // Öffentliche Schlüssel zur Verifikation der Rezeptsignaturen
  app.get('/.well-known/prescriptcheck/keys', (_req, res) => res.json({ keys: ctx.keyring.listPublic() }));

  app.use('/api/v1', createRouter(ctx));
  app.use(notFoundHandler);
  app.use(createErrorHandler(ctx.log));
  return app;
}

module.exports = { createApp };
