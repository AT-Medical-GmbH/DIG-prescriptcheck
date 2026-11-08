'use strict';

const jwt = require('jsonwebtoken');
const { unauthorized, forbidden } = require('../lib/errors');

/**
 * Authentifizierung: JWT (HS256, 15 min) + serverseitige Sitzungsprüfung bei jeder Anfrage,
 * damit Abmeldung/Sperre sofort wirkt.
 *
 * Zwei Varianten:
 *  - authenticate:      volle Anmeldung; erzwingt Passwortwechsel und MFA-Einrichtung (falls Pflicht)
 *  - authenticateSetup: nur für Kontoeinrichtung (Passwort ändern, MFA einrichten, abmelden, /me);
 *                       die Zuordnung erfolgt explizit je Route, nicht über URL-Muster.
 */
function createAuthMiddleware(ctx) {
  const users = ctx.col('users');
  const sessions = ctx.col('sessions');
  const orgs = ctx.col('organizations');

  async function load(req) {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw unauthorized();
    let claims;
    try {
      claims = jwt.verify(token, ctx.config.jwtSecret, { algorithms: ['HS256'] });
    } catch {
      throw unauthorized('INVALID_TOKEN', 'Sitzung abgelaufen.');
    }
    const [session, user] = await Promise.all([sessions.findOne({ _id: claims.sid }), users.findOne({ _id: claims.sub })]);
    if (!session || session.revokedAt || session.expiresAt <= ctx.now() || !user || user.status !== 'ACTIVE') {
      throw unauthorized('INVALID_TOKEN', 'Sitzung abgelaufen.');
    }
    const org = user.orgId ? await orgs.findOne({ _id: user.orgId }) : null;
    req.auth = { user, session, org };
    return user;
  }

  const authenticateSetup = async (req, _res, next) => {
    await load(req);
    next();
  };

  const authenticate = async (req, _res, next) => {
    const user = await load(req);
    if (user.mustChangePassword) throw forbidden('PASSWORD_CHANGE_REQUIRED', 'Bitte zuerst das Passwort ändern.');
    if (ctx.config.requireMfa && !user.mfaEnabled) {
      throw forbidden('MFA_ENROLLMENT_REQUIRED', 'Bitte zuerst die Zwei-Faktor-Authentifizierung einrichten.');
    }
    next();
  };

  return { authenticate, authenticateSetup };
}

/** Rollenprüfung. */
const requireRole = (...roles) => (req, _res, next) => {
  if (!req.auth || !roles.includes(req.auth.user.role)) throw forbidden();
  next();
};

module.exports = { createAuthMiddleware, requireRole };
