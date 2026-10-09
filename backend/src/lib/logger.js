'use strict';

/**
 * Strukturiertes JSON-Logging. Es werden bewusst nie Gesundheitsdaten, Passwörter
 * oder Tokens geloggt – nur technische Metadaten und Korrelations-IDs.
 */
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

function createLogger(level = process.env.LOG_LEVEL || 'info') {
  const threshold = LEVELS[level] ?? LEVELS.info;
  const write = (lvl, msg, meta) => {
    if (LEVELS[lvl] < threshold) return;
    const line = JSON.stringify({ ts: new Date().toISOString(), level: lvl, msg, ...meta });
    (lvl === 'error' || lvl === 'warn' ? process.stderr : process.stdout).write(`${line}\n`);
  };
  return {
    debug: (m, x) => write('debug', m, x),
    info: (m, x) => write('info', m, x),
    warn: (m, x) => write('warn', m, x),
    error: (m, x) => write('error', m, x),
  };
}

module.exports = { createLogger };
