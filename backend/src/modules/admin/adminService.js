'use strict';

const { randomUUID } = require('crypto');
const { hashPassword, assertPasswordPolicy, generatePassword } = require('../../lib/password');
const v = require('../../lib/validate');
const { notFound, forbidden, badRequest, conflict } = require('../../lib/errors');
const { ROLES, ORG_TYPES, rolesForOrgType, PLATFORM_ROLES, PRACTICE_ROLES, PHARMACY_ROLES } = require('../roles');
const { publicUser, chainOf } = require('../auth/authService');

const orgView = (o) => ({ id: o._id, type: o.type, name: o.name, address: o.address || {}, status: o.status, verifiedAt: o.verifiedAt, createdAt: o.createdAt });

function createAdminService(ctx) {
  const orgs = ctx.col('organizations');
  const users = ctx.col('users');

  async function createOrganization(actor, body, meta = {}) {
    v.obj(body);
    const type = v.oneOf(body.type, 'type', Object.values(ORG_TYPES));
    const name = v.str(body.name, 'name', { max: 160 });
    const address = body.address
      ? { street: v.str(body.address.street, 'street', { optional: true, max: 120 }), zip: v.str(body.address.zip, 'zip', { optional: true, max: 10 }), city: v.str(body.address.city, 'city', { optional: true, max: 80 }), phone: v.str(body.address.phone, 'phone', { optional: true, max: 40 }) }
      : {};
    const org = await orgs.insertOne({
      _id: randomUUID(), type, name, address, status: 'ACTIVE',
      // Die Berechtigungsprüfung (Approbation/Betriebserlaubnis) erfolgt manuell außerhalb des Systems (Konzept 7.1)
      verifiedAt: ctx.now(), verifiedBy: actor._id, createdAt: ctx.now(),
    }).catch((e) => {
      if (e.code === 'DUPLICATE') throw conflict('ORG_EXISTS', 'Eine Organisation mit diesem Namen existiert bereits.');
      throw e;
    });
    await ctx.audit.record({ chains: ['platform', org._id], actor: { userId: actor._id, role: actor.role }, action: 'ORG_CREATED', object: { type: 'organization', id: org._id }, detail: { orgType: type }, ip: meta.ip, requestId: meta.requestId });
    return orgView(org);
  }

  async function listOrganizations() {
    return (await orgs.find({}, { sort: { createdAt: -1 } })).map(orgView);
  }

  async function setOrganizationStatus(actor, id, body, meta = {}) {
    const status = v.oneOf(v.obj(body).status, 'status', ['ACTIVE', 'SUSPENDED']);
    const r = await orgs.updateOne({ _id: id }, { $set: { status } });
    if (!r.matchedCount) throw notFound('ORG_NOT_FOUND', 'Organisation nicht gefunden.');
    await ctx.audit.record({ chains: ['platform', id], actor: { userId: actor._id, role: actor.role }, action: 'ORG_STATUS_CHANGED', object: { type: 'organization', id }, detail: { status }, ip: meta.ip, requestId: meta.requestId });
    return orgView(await orgs.findOne({ _id: id }));
  }

  /**
   * Nutzer anlegen. Plattform-Admin darf alle Rollen anlegen, Organisations-Admins nur
   * Rollen ihrer eigenen Organisation. Das Initialpasswort wird einmalig zurückgegeben.
   */
  async function createUser(actor, body, meta = {}) {
    v.obj(body);
    const email = v.email(body.email);
    const name = v.str(body.name, 'name', { max: 120 });
    const role = v.oneOf(body.role, 'role', Object.values(ROLES));

    let orgId = null;
    let org = null;
    if (PLATFORM_ROLES.includes(role)) {
      if (actor.role !== ROLES.PLATFORM_ADMIN) throw forbidden();
    } else {
      orgId = actor.role === ROLES.PLATFORM_ADMIN ? v.str(body.orgId, 'orgId', { max: 64 }) : actor.orgId;
      org = await orgs.findOne({ _id: orgId });
      if (!org) throw notFound('ORG_NOT_FOUND', 'Organisation nicht gefunden.');
      if (!rolesForOrgType(org.type).includes(role)) throw badRequest('ROLE_ORG_MISMATCH', 'Rolle passt nicht zum Organisationstyp.');
      if (actor.role !== ROLES.PLATFORM_ADMIN && ![ROLES.PRACTICE_ADMIN, ROLES.PHARMACY_ADMIN].includes(actor.role)) throw forbidden();
    }

    let password = body.initialPassword;
    const generated = !password;
    if (generated) password = generatePassword();
    else assertPasswordPolicy(password, { email });

    const user = await users.insertOne({
      _id: randomUUID(), email, name, role, orgId, status: 'ACTIVE',
      passwordHash: await hashPassword(password, ctx.config.scryptN),
      mustChangePassword: true, mfaEnabled: false, failedLogins: 0, lockedUntil: 0, createdAt: ctx.now(),
    }).catch((e) => {
      if (e.code === 'DUPLICATE') throw conflict('USER_EXISTS', 'Ein Nutzer mit dieser E-Mail existiert bereits.');
      throw e;
    });
    await ctx.audit.record({ chains: [orgId || 'platform'], actor: { userId: actor._id, role: actor.role, orgId: actor.orgId }, action: 'USER_CREATED', object: { type: 'user', id: user._id }, detail: { role }, ip: meta.ip, requestId: meta.requestId });
    return { user: publicUser(user, org), ...(generated ? { initialPassword: password } : {}) };
  }

  async function listUsers(actor, { orgId } = {}) {
    const scope = actor.role === ROLES.PLATFORM_ADMIN ? (orgId ? { orgId } : {}) : { orgId: actor.orgId };
    const rows = await users.find(scope, { sort: { createdAt: -1 } });
    return rows.map((u) => ({ ...publicUser(u), status: u.status, lastLoginAt: u.lastLoginAt || null }));
  }

  async function setUserStatus(actor, id, body, meta = {}) {
    const status = v.oneOf(v.obj(body).status, 'status', ['ACTIVE', 'DISABLED']);
    const target = await users.findOne({ _id: id });
    const allowed = target && (actor.role === ROLES.PLATFORM_ADMIN || (target.orgId && target.orgId === actor.orgId));
    if (!allowed) throw notFound('USER_NOT_FOUND', 'Nutzer nicht gefunden.');
    if (target._id === actor._id) throw badRequest('SELF_CHANGE', 'Das eigene Konto kann nicht deaktiviert werden.');
    await users.updateOne({ _id: id }, { $set: { status } });
    if (status === 'DISABLED') {
      for (const s of await ctx.col('sessions').find({ userId: id, revokedAt: null })) await ctx.col('sessions').updateOne({ _id: s._id }, { $set: { revokedAt: ctx.now() } });
    }
    await ctx.audit.record({ chains: [chainOf(target)], actor: { userId: actor._id, role: actor.role, orgId: actor.orgId }, action: 'USER_STATUS_CHANGED', object: { type: 'user', id }, detail: { status }, ip: meta.ip, requestId: meta.requestId });
    return { id, status };
  }

  return { createOrganization, listOrganizations, setOrganizationStatus, createUser, listUsers, setUserStatus, PRACTICE_ROLES, PHARMACY_ROLES };
}

module.exports = { createAdminService };
