'use strict';

const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const { sha256Hex, randomToken, safeEqual } = require('../../lib/crypto');
const { hashPassword, verifyPassword, assertPasswordPolicy } = require('../../lib/password');
const { generateSecret, verifyTotp, otpauthUrl } = require('../../lib/totp');
const { unauthorized, tooMany, conflict, badRequest } = require('../../lib/errors');

const MAX_FAILED = 5;
const LOCK_MS = 15 * 60 * 1000;

const chainOf = (user) => user.orgId || 'platform';

function publicUser(user, org) {
  return {
    id: user._id,
    email: user.email,
    name: user.name,
    role: user.role,
    orgId: user.orgId || null,
    orgName: org ? org.name : null,
    orgType: org ? org.type : null,
    mfaEnabled: !!user.mfaEnabled,
    mustChangePassword: !!user.mustChangePassword,
  };
}

function createAuthService(ctx) {
  const users = ctx.col('users');
  const sessions = ctx.col('sessions');
  const orgs = ctx.col('organizations');
  // Scheinhash: gleiche Rechenzeit, wenn der Nutzer nicht existiert (verhindert Nutzer-Enumeration per Timing)
  const dummyHashPromise = hashPassword('dummy-password-for-timing', ctx.config.scryptN);

  function issueTokens(user, session, refreshSecret) {
    const accessToken = jwt.sign({ sub: user._id, sid: session._id, role: user.role, org: user.orgId || null }, ctx.config.jwtSecret, {
      algorithm: 'HS256',
      expiresIn: ctx.config.accessTokenTtlSec,
    });
    return { accessToken, refreshToken: `${session._id}.${refreshSecret}`, expiresIn: ctx.config.accessTokenTtlSec };
  }

  async function startSession(user, meta) {
    const refreshSecret = randomToken(32);
    const session = await sessions.insertOne({
      _id: randomUUID(),
      userId: user._id,
      refreshHash: sha256Hex(refreshSecret),
      createdAt: ctx.now(),
      expiresAt: ctx.now() + ctx.config.sessionTtlSec * 1000,
      revokedAt: null,
      ip: meta.ip || null,
    });
    return issueTokens(user, session, refreshSecret);
  }

  async function failLogin(user, meta, reason) {
    const failed = (user.failedLogins || 0) + 1;
    const lock = failed >= MAX_FAILED;
    await users.updateOne({ _id: user._id }, { $set: { failedLogins: lock ? 0 : failed, lockedUntil: lock ? ctx.now() + LOCK_MS : user.lockedUntil || 0 } });
    await ctx.audit.record({ chains: [chainOf(user)], actor: { userId: user._id, role: user.role, orgId: user.orgId }, action: 'LOGIN_FAILED', result: 'FAIL', detail: { reason, locked: lock }, ip: meta.ip, requestId: meta.requestId });
  }

  async function login({ email, password, totp }, meta = {}) {
    const user = await users.findOne({ email });
    if (!user) {
      await verifyPassword(password, await dummyHashPromise);
      await ctx.audit.record({ chains: ['platform'], action: 'LOGIN_FAILED', result: 'FAIL', detail: { reason: 'UNKNOWN_USER' }, ip: meta.ip, requestId: meta.requestId });
      throw unauthorized('INVALID_CREDENTIALS', 'E-Mail oder Passwort falsch.');
    }
    if (user.lockedUntil && user.lockedUntil > ctx.now()) throw tooMany('ACCOUNT_LOCKED', 'Konto vorübergehend gesperrt. Bitte später erneut versuchen.');
    const passwordOk = await verifyPassword(password, user.passwordHash);
    if (!passwordOk || user.status !== 'ACTIVE') {
      await failLogin(user, meta, passwordOk ? 'DISABLED' : 'BAD_PASSWORD');
      throw unauthorized('INVALID_CREDENTIALS', 'E-Mail oder Passwort falsch.');
    }

    let usedStep = null;
    if (user.mfaEnabled) {
      if (!totp) throw unauthorized('MFA_REQUIRED', 'Bitte den Code aus der Authenticator-App eingeben.');
      const secret = ctx.vault.decrypt(user.orgId || 'platform', user.mfaSecretEnc);
      usedStep = verifyTotp(secret, totp, ctx.now());
      if (usedStep === null || usedStep <= (user.lastTotpStep || 0)) {
        await failLogin(user, meta, 'BAD_TOTP');
        throw unauthorized('INVALID_CREDENTIALS', 'E-Mail, Passwort oder Code falsch.');
      }
    }
    await users.updateOne({ _id: user._id }, { $set: { failedLogins: 0, lockedUntil: 0, lastLoginAt: ctx.now(), ...(usedStep !== null ? { lastTotpStep: usedStep } : {}) } });
    const tokens = await startSession(user, meta);
    await ctx.audit.record({ chains: [chainOf(user)], actor: { userId: user._id, role: user.role, orgId: user.orgId }, action: 'LOGIN_SUCCESS', ip: meta.ip, requestId: meta.requestId });
    const org = user.orgId ? await orgs.findOne({ _id: user.orgId }) : null;
    return { ...tokens, user: publicUser(user, org) };
  }

  async function refresh(refreshToken, meta = {}) {
    const [sid, secret] = String(refreshToken || '').split('.');
    const session = sid ? await sessions.findOne({ _id: sid }) : null;
    if (!session || !secret || session.revokedAt || session.expiresAt <= ctx.now()) throw unauthorized('INVALID_REFRESH', 'Sitzung abgelaufen.');
    const oldHash = sha256Hex(secret);
    if (!safeEqual(oldHash, session.refreshHash)) {
      // Wiederverwendung eines bereits rotierten Tokens → Sitzung vorsorglich beenden
      await sessions.updateOne({ _id: sid }, { $set: { revokedAt: ctx.now() } });
      throw unauthorized('INVALID_REFRESH', 'Sitzung abgelaufen.');
    }
    const user = await users.findOne({ _id: session.userId });
    if (!user || user.status !== 'ACTIVE') throw unauthorized('INVALID_REFRESH', 'Sitzung abgelaufen.');
    const newSecret = randomToken(32);
    const rotated = await sessions.updateOne({ _id: sid, refreshHash: oldHash, revokedAt: null }, { $set: { refreshHash: sha256Hex(newSecret) } });
    if (rotated.modifiedCount !== 1) throw unauthorized('INVALID_REFRESH', 'Sitzung abgelaufen.');
    return issueTokens(user, session, newSecret);
  }

  async function logout(sessionId, user, meta = {}) {
    await sessions.updateOne({ _id: sessionId }, { $set: { revokedAt: ctx.now() } });
    await ctx.audit.record({ chains: [chainOf(user)], actor: { userId: user._id, role: user.role, orgId: user.orgId }, action: 'LOGOUT', ip: meta.ip, requestId: meta.requestId });
  }

  async function changePassword(user, sessionId, { currentPassword, newPassword }, meta = {}) {
    if (!(await verifyPassword(currentPassword, user.passwordHash))) throw unauthorized('INVALID_CREDENTIALS', 'Aktuelles Passwort falsch.');
    assertPasswordPolicy(newPassword, { email: user.email });
    if (currentPassword === newPassword) throw badRequest('WEAK_PASSWORD', 'Das neue Passwort muss sich vom alten unterscheiden.');
    await users.updateOne({ _id: user._id }, { $set: { passwordHash: await hashPassword(newPassword, ctx.config.scryptN), mustChangePassword: false } });
    // alle anderen Sitzungen beenden
    const all = await sessions.find({ userId: user._id, revokedAt: null });
    for (const s of all) if (s._id !== sessionId) await sessions.updateOne({ _id: s._id }, { $set: { revokedAt: ctx.now() } });
    await ctx.audit.record({ chains: [chainOf(user)], actor: { userId: user._id, role: user.role, orgId: user.orgId }, action: 'PASSWORD_CHANGED', ip: meta.ip, requestId: meta.requestId });
  }

  async function mfaEnroll(user) {
    if (user.mfaEnabled) throw conflict('MFA_ALREADY_ENABLED', 'Zwei-Faktor-Authentifizierung ist bereits aktiv.');
    const secret = generateSecret();
    await users.updateOne({ _id: user._id }, { $set: { pendingMfaSecretEnc: ctx.vault.encrypt(user.orgId || 'platform', secret) } });
    return { secret, otpauthUrl: otpauthUrl(secret, user.email) };
  }

  async function mfaConfirm(user, code, meta = {}) {
    if (!user.pendingMfaSecretEnc) throw badRequest('MFA_NOT_STARTED', 'Einrichtung nicht gestartet.');
    const secret = ctx.vault.decrypt(user.orgId || 'platform', user.pendingMfaSecretEnc);
    const step = verifyTotp(secret, code, ctx.now());
    if (step === null) throw badRequest('INVALID_CODE', 'Code ungültig.');
    await users.updateOne({ _id: user._id }, { $set: { mfaEnabled: true, mfaSecretEnc: user.pendingMfaSecretEnc, pendingMfaSecretEnc: null, lastTotpStep: step } });
    await ctx.audit.record({ chains: [chainOf(user)], actor: { userId: user._id, role: user.role, orgId: user.orgId }, action: 'MFA_ENABLED', ip: meta.ip, requestId: meta.requestId });
  }

  return { login, refresh, logout, changePassword, mfaEnroll, mfaConfirm, publicUser };
}

module.exports = { createAuthService, publicUser, chainOf };
