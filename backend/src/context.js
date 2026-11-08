'use strict';

const { createVault } = require('./lib/crypto');
const { AuditLog } = require('./modules/audit/audit');
const { createLogger } = require('./lib/logger');

/**
 * Anwendungskontext: alle Abhängigkeiten der Fachlogik an einer Stelle.
 * Tests können `now` überschreiben, um Zeit zu steuern.
 */
function createContext({ config, store, now = () => Date.now(), logger }) {
  const vault = createVault(config.masterKey);
  const log = logger || createLogger(config.logLevel);
  return {
    config,
    store,
    vault,
    keyring: config.keyring,
    audit: new AuditLog({ store, vault, now }),
    now,
    log,
    col: (name) => store.collection(name),
  };
}

module.exports = { createContext };
