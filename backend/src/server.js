'use strict';

require('dotenv').config();
const { loadConfig } = require('./config');
const { createLogger } = require('./lib/logger');
const { MemoryStore } = require('./store/memory');
const { MongoStore } = require('./store/mongo');
const { createContext } = require('./context');
const { createApp } = require('./app');
const { seedDemo } = require('./scripts/seedDemo');

async function main() {
  const log = createLogger();
  const config = loadConfig(process.env, log);
  const store = config.storeType === 'mongo' ? new MongoStore(config.mongoUri) : new MemoryStore();
  if (store.connect) await store.connect();
  await store.init();
  const ctx = createContext({ config, store, logger: createLogger(config.logLevel) });
  if (config.seedDemo) await seedDemo(ctx);

  const server = createApp(ctx).listen(config.port, () => {
    log.info('PrescriptCheck-Backend gestartet', { port: config.port, env: config.nodeEnv, store: config.storeType, mfaRequired: config.requireMfa });
  });

  const shutdown = (signal) => {
    log.info('Beende', { signal });
    server.close(async () => {
      await store.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  process.stderr.write(`${err.code === 'CONFIG_INVALID' ? err.message : err.stack}\n`);
  process.exit(1);
});
