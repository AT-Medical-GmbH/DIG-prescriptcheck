'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const v = require('../lib/validate');
const { badRequest, forbidden } = require('../lib/errors');
const { ROLES } = require('../modules/roles');
const { createAuthMiddleware, requireRole } = require('../middleware/auth');
const { createAuthService } = require('../modules/auth/authService');
const { createAdminService } = require('../modules/admin/adminService');
const { createNotificationService } = require('../modules/notifications/notificationService');
const { createPrescriptionService } = require('../modules/prescriptions/prescriptionService');
const { createVerificationService } = require('../modules/verification/verificationService');
const { createQsService } = require('../modules/qs/qsService');

const meta = (req) => ({ ip: req.ip, requestId: req.id });

function createRouter(ctx) {
  const router = express.Router();
  const { authenticate, authenticateSetup } = createAuthMiddleware(ctx);
  const auth = createAuthService(ctx);
  const admin = createAdminService(ctx);
  const notifications = createNotificationService(ctx);
  const rx = createPrescriptionService(ctx);
  const verification = createVerificationService(ctx, notifications);
  const qs = createQsService(ctx, notifications);

  const limiter = (windowMs, limit, keyGenerator, extra = {}) =>
    ctx.config.rateLimitEnabled
      ? rateLimit({ windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false, ...extra, ...(keyGenerator ? { keyGenerator } : {}), message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Zu viele Anfragen. Bitte später erneut versuchen.' } } })
      : (_req, _res, next) => next();
  // Nur Fehlversuche zählen: Praxen/Apotheken teilen sich oft eine IP (NAT), reguläre Anmeldungen und
  // Token-Erneuerungen mehrerer Personen dürfen das Limit nicht aufbrauchen.
  const loginLimiter = limiter(15 * 60 * 1000, 20, undefined, { skipSuccessfulRequests: true });
  const perUser = limiter(60 * 1000, 120, (req) => (req.auth ? req.auth.user._id : 'anon'));

  const practiceStaff = [ROLES.PRESCRIBER, ROLES.PRACTICE_STAFF];
  const pharmacyStaff = [ROLES.PHARMACIST, ROLES.PHARMACY_STAFF];
  const orgRoles = [ROLES.PRACTICE_ADMIN, ROLES.PRESCRIBER, ROLES.PRACTICE_STAFF, ROLES.PHARMACY_ADMIN, ROLES.PHARMACIST, ROLES.PHARMACY_STAFF];
  const user = (req) => req.auth.user;

  // ---------- Authentifizierung ----------
  router.post('/auth/login', loginLimiter, async (req, res) => {
    const b = v.obj(req.body);
    if (typeof b.password !== 'string' || !b.password || b.password.length > 200) throw badRequest('VALIDATION_ERROR', 'password: Pflichtfeld');
    res.json(await auth.login({ email: v.email(b.email), password: b.password, totp: v.str(b.totp, 'totp', { optional: true, max: 12 }) }, meta(req)));
  });
  router.post('/auth/refresh', loginLimiter, async (req, res) => {
    res.json(await auth.refresh(v.str(v.obj(req.body).refreshToken, 'refreshToken', { max: 200 }), meta(req)));
  });
  router.post('/auth/logout', authenticateSetup, async (req, res) => {
    await auth.logout(req.auth.session._id, user(req), meta(req));
    res.status(204).end();
  });
  router.get('/auth/me', authenticateSetup, (req, res) => res.json({ user: auth.publicUser(user(req), req.auth.org), mfaRequired: ctx.config.requireMfa }));
  router.post('/auth/change-password', authenticateSetup, async (req, res) => {
    const b = v.obj(req.body);
    if (typeof b.currentPassword !== 'string' || typeof b.newPassword !== 'string') throw badRequest('VALIDATION_ERROR', 'Passwörter erforderlich');
    await auth.changePassword(user(req), req.auth.session._id, b, meta(req));
    res.status(204).end();
  });
  router.post('/auth/mfa/enroll', authenticateSetup, async (req, res) => res.json(await auth.mfaEnroll(user(req))));
  router.post('/auth/mfa/confirm', authenticateSetup, async (req, res) => {
    await auth.mfaConfirm(user(req), v.str(v.obj(req.body).code, 'code', { max: 10 }), meta(req));
    res.status(204).end();
  });

  // ---------- Verwaltung ----------
  router.get('/admin/organizations', authenticate, requireRole(ROLES.PLATFORM_ADMIN), async (_req, res) => res.json(await admin.listOrganizations()));
  router.post('/admin/organizations', authenticate, requireRole(ROLES.PLATFORM_ADMIN), async (req, res) => res.status(201).json(await admin.createOrganization(user(req), req.body, meta(req))));
  router.patch('/admin/organizations/:id', authenticate, requireRole(ROLES.PLATFORM_ADMIN), async (req, res) => res.json(await admin.setOrganizationStatus(user(req), req.params.id, req.body, meta(req))));
  router.get('/admin/users', authenticate, requireRole(ROLES.PLATFORM_ADMIN), async (req, res) => res.json(await admin.listUsers(user(req), { orgId: req.query.orgId })));
  router.post('/admin/users', authenticate, requireRole(ROLES.PLATFORM_ADMIN), async (req, res) => res.status(201).json(await admin.createUser(user(req), req.body, meta(req))));
  router.get('/org/users', authenticate, requireRole(ROLES.PRACTICE_ADMIN, ROLES.PHARMACY_ADMIN), async (req, res) => res.json(await admin.listUsers(user(req))));
  router.post('/org/users', authenticate, requireRole(ROLES.PRACTICE_ADMIN, ROLES.PHARMACY_ADMIN), async (req, res) => res.status(201).json(await admin.createUser(user(req), req.body, meta(req))));
  router.post('/users/:id/reset-credentials', authenticate, requireRole(ROLES.PLATFORM_ADMIN, ROLES.PRACTICE_ADMIN, ROLES.PHARMACY_ADMIN), async (req, res) => res.json(await admin.resetCredentials(user(req), req.params.id, req.body, meta(req))));
  router.patch('/users/:id/status', authenticate, requireRole(ROLES.PLATFORM_ADMIN, ROLES.PRACTICE_ADMIN, ROLES.PHARMACY_ADMIN), async (req, res) => res.json(await admin.setUserStatus(user(req), req.params.id, req.body, meta(req))));

  // ---------- Praxis: Rezepte ----------
  const pr = express.Router();
  pr.use(authenticate, requireRole(...practiceStaff), perUser);
  pr.get('/', async (req, res) => res.json(await rx.list(user(req), { state: req.query.state, q: req.query.q, limit: req.query.limit })));
  pr.post('/', async (req, res) => res.status(201).json(await rx.createDraft(user(req), req.body, meta(req))));
  pr.post('/block-bulk', requireRole(ROLES.PRESCRIBER), async (req, res) => res.json(await rx.blockMany(user(req), req.body, meta(req))));
  pr.post('/block-all-open', requireRole(ROLES.PRESCRIBER), async (req, res) => res.json(await rx.blockAllOpen(user(req), req.body, meta(req))));
  pr.get('/:id', async (req, res) => res.json(await rx.get(user(req), req.params.id)));
  pr.put('/:id', async (req, res) => res.json(await rx.updateDraft(user(req), req.params.id, req.body, meta(req))));
  pr.post('/:id/discard', async (req, res) => res.json(await rx.discard(user(req), req.params.id, meta(req))));
  pr.post('/:id/issue', requireRole(ROLES.PRESCRIBER), async (req, res) => res.json(await rx.issue(user(req), req.params.id, meta(req))));
  pr.post('/:id/block', requireRole(ROLES.PRESCRIBER), async (req, res) => res.json(await rx.block(user(req), req.params.id, req.body, meta(req))));
  pr.post('/:id/unblock', requireRole(ROLES.PRESCRIBER), async (req, res) => res.json(await rx.unblock(user(req), req.params.id, req.body, meta(req))));
  pr.get('/:id/pdf', async (req, res) => {
    const { pdf, serial } = await rx.renderPdf(user(req), req.params.id, meta(req));
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="Rezept-${serial}.pdf"` }).send(pdf);
  });
  router.use('/prescriptions', pr);

  // ---------- Apotheke: Prüfung und Einlösung ----------
  const phGuard = (...roles) => [authenticate, requireRole(...roles), perUser];
  router.post('/verifications', phGuard(...pharmacyStaff), async (req, res) => res.json(await verification.check(user(req), req.body, meta(req))));
  router.post('/verifications/:id/identity-check', phGuard(...pharmacyStaff), async (req, res) => res.json(await verification.identityCheck(user(req), req.params.id, req.body, meta(req))));
  router.post('/redemptions', phGuard(...pharmacyStaff), async (req, res) => res.status(201).json(await verification.redeem(user(req), req.body, meta(req))));
  router.get('/redemptions', phGuard(...pharmacyStaff), async (req, res) => res.json(await verification.listRedemptions(user(req), { limit: req.query.limit })));
  router.post('/redemptions/:serial/cancel', phGuard(ROLES.PHARMACIST), async (req, res) => res.json(await verification.cancelRedemption(user(req), req.params.serial, req.body, meta(req))));
  router.post('/qs/reports', phGuard(...pharmacyStaff), async (req, res) => res.status(201).json(await verification.reportSuspicion(user(req), req.body, meta(req))));

  // ---------- Qualitätssicherung ----------
  router.get('/qs/flagged', authenticate, requireRole(ROLES.SUPERVISOR), async (_req, res) => res.json(await qs.listFlagged()));
  router.post('/qs/prescriptions/:serial/unblock', authenticate, requireRole(ROLES.SUPERVISOR), async (req, res) => res.json(await qs.unblock(user(req), req.params.serial, req.body, meta(req))));

  // ---------- Audit ----------
  const auditChain = (req) => {
    const u = user(req);
    if ([ROLES.PLATFORM_ADMIN, ROLES.AUDITOR].includes(u.role)) return String(req.query.chain || 'platform');
    if ([ROLES.PRACTICE_ADMIN, ROLES.PHARMACY_ADMIN].includes(u.role)) return u.orgId;
    throw forbidden();
  };
  router.get('/audit', authenticate, requireRole(ROLES.PLATFORM_ADMIN, ROLES.AUDITOR, ROLES.PRACTICE_ADMIN, ROLES.PHARMACY_ADMIN), async (req, res) => {
    const chain = auditChain(req);
    res.json({ chain, entries: await ctx.audit.list(chain, { limit: Math.min(Number(req.query.limit) || 50, 200), beforeSeq: Number(req.query.beforeSeq) || undefined }) });
  });
  router.get('/audit/verify', authenticate, requireRole(ROLES.PLATFORM_ADMIN, ROLES.AUDITOR, ROLES.PRACTICE_ADMIN, ROLES.PHARMACY_ADMIN), async (req, res) => {
    const chain = auditChain(req);
    res.json({ chain, ...(await ctx.audit.verify(chain)) });
  });

  // ---------- Benachrichtigungen ----------
  router.get('/notifications', authenticate, requireRole(...orgRoles), async (req, res) => res.json(await notifications.list(user(req).orgId, { limit: req.query.limit })));
  router.post('/notifications/read-all', authenticate, requireRole(...orgRoles), async (req, res) => res.json(await notifications.markAllRead(user(req).orgId)));

  return router;
}

module.exports = { createRouter };
