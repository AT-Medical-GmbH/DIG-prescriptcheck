'use strict';

const { randomUUID } = require('crypto');
const { canonicalJson, sha256Hex, randomToken, safeEqual } = require('../../lib/crypto');
const { parseSerial } = require('../../lib/ids');
const { decodeCode } = require('../../lib/rxCode');
const { STATES, effectiveState } = require('../../lib/stateMachine');
const v = require('../../lib/validate');
const { badRequest, conflict, forbidden, notFound, tooMany, unauthorized } = require('../../lib/errors');

const VERIFICATION_TTL_MS = 10 * 60 * 1000;
const TOKEN_TTL_MS = 5 * 60 * 1000;
const CANCEL_WINDOW_MS = 15 * 60 * 1000;
const DOB_MAX_ATTEMPTS = 3;
const DOB_LOCK_MS = 15 * 60 * 1000;
const SOON_MS = 48 * 60 * 60 * 1000;
const REPORT_CATEGORIES = ['FORGERY_SUSPECTED', 'IDENTITY_MISMATCH', 'ALTERED', 'OTHER'];

/**
 * Prüfung → Identitätsabgleich → Einlösung (Konzept 7.3).
 * Die Apotheke sieht Rezeptinhalte erst NACH erfolgreichem Geburtsdatum-Abgleich;
 * das gespeicherte Geburtsdatum wird nie ausgegeben.
 */
function createVerificationService(ctx, notifications) {
  const rxs = ctx.col('prescriptions');
  const verifications = ctx.col('verifications');
  const tokens = ctx.col('redemption_tokens');
  const orgs = ctx.col('organizations');
  const users = ctx.col('users');
  const { vault, keyring } = ctx;

  const actorOf = (a) => ({ userId: a._id, role: a.role, orgId: a.orgId });

  async function requireActivePharmacy(actor) {
    const org = await orgs.findOne({ _id: actor.orgId });
    if (!org || org.status !== 'ACTIVE') throw forbidden('ORG_SUSPENDED', 'Die Apotheke ist gesperrt.');
    return org;
  }

  /** Stimmen Inhalt, Hash und gespeicherter Code überein? (erkennt Manipulation in der Datenbank) */
  function integrityOk(rx) {
    const dec = decodeCode(rx.code, keyring);
    if (!dec.ok) return false;
    if (dec.serial !== rx.serial || dec.hashPrefix !== rx.contentHash.slice(0, 32)) return false;
    if (dec.expSec * 1000 !== rx.expiresAt || dec.iatSec * 1000 !== rx.issuedAt) return false;
    const content = vault.decryptJson(rx.practiceOrgId, rx.contentEnc);
    const recomputed = sha256Hex(canonicalJson({ serial: rx.serial, practiceOrgId: rx.practiceOrgId, prescriberId: rx.prescriberId, issuedAt: rx.issuedAt, expiresAt: rx.expiresAt, salt: rx.salt, ...content }));
    return safeEqual(recomputed, rx.contentHash);
  }

  async function check(actor, body, meta = {}) {
    v.obj(body);
    const log = (chains, detail, ok) => ctx.audit.record({ chains, actor: actorOf(actor), action: 'VERIFY_CHECK', result: ok ? 'OK' : 'FAIL', detail, ip: meta.ip, requestId: meta.requestId });
    const red = async (reason, extra = {}, rx = null) => {
      await log([actor.orgId, rx && rx.practiceOrgId], { result: 'RED', reason, ...(rx ? { serial: rx.serial } : {}) }, false);
      return { result: 'RED', reasons: [reason], ...extra };
    };

    let serial;
    let scanned = null;
    if (body.code) {
      scanned = decodeCode(String(body.code), keyring);
      if (!scanned.ok) return red(scanned.reason === 'SIGNATURE' ? 'SIGNATURE_INVALID' : 'CODE_UNREADABLE');
      serial = scanned.serial;
    } else {
      const parsed = parseSerial(body.serial);
      if (!parsed) return red('SERIAL_INVALID');
      serial = parsed.serial;
    }

    const rx = await rxs.findOne({ serial });
    if (!rx || rx.state === STATES.DRAFT || rx.state === STATES.DISCARDED) return red('UNKNOWN');
    if (scanned && (scanned.hashPrefix !== rx.contentHash.slice(0, 32) || scanned.expSec * 1000 !== rx.expiresAt || scanned.iatSec * 1000 !== rx.issuedAt)) {
      return red('CODE_MISMATCH', {}, rx);
    }
    if (!integrityOk(rx)) return red('INTEGRITY_FAILED', {}, rx);

    const eff = effectiveState(rx, ctx.now());
    if (eff === STATES.BLOCKED) return red('BLOCKED', { blockReason: rx.blockReason || null }, rx);
    if (eff === STATES.REDEEMED) return red('ALREADY_REDEEMED', { redeemedAt: rx.redeemedAt }, rx);
    if (eff === STATES.EXPIRED) return red('EXPIRED', { expiredAt: rx.expiresAt }, rx);
    if (rx.dobLockedUntil && rx.dobLockedUntil > ctx.now()) return red('TEMP_LOCKED', { lockedUntil: rx.dobLockedUntil }, rx);

    const reasons = [];
    if ((rx.qsFlags || []).length) reasons.push('QS_FLAGGED');
    if ((rx.printCount || 0) > 1) reasons.push('DUPLICATE_PRINT');
    if (rx.expiresAt - ctx.now() < SOON_MS) reasons.push('EXPIRES_SOON');
    const result = reasons.length ? 'YELLOW' : 'GREEN';

    const [practice, prescriber] = await Promise.all([orgs.findOne({ _id: rx.practiceOrgId }), users.findOne({ _id: rx.prescriberId })]);
    const ver = await verifications.insertOne({
      _id: randomUUID(), rxId: rx._id, serial, pharmacyOrgId: actor.orgId, userId: actor._id,
      createdAt: ctx.now(), expiresAt: ctx.now() + VERIFICATION_TTL_MS, result,
    });
    await log([actor.orgId, rx.practiceOrgId], { result, reasons, serial }, true);
    return {
      result, reasons, verificationId: ver._id, serial, issuedAt: rx.issuedAt, expiresAt: rx.expiresAt,
      practiceName: practice ? practice.name : null, prescriberName: prescriber ? prescriber.name : null,
      verificationExpiresAt: ver.expiresAt,
    };
  }

  async function loadVerification(actor, id) {
    const ver = await verifications.findOne({ _id: String(id), pharmacyOrgId: actor.orgId, userId: actor._id });
    if (!ver) throw notFound('VERIFICATION_NOT_FOUND', 'Prüfvorgang nicht gefunden.');
    if (ver.expiresAt <= ctx.now()) throw conflict('VERIFICATION_EXPIRED', 'Der Prüfvorgang ist abgelaufen. Bitte erneut prüfen.');
    return ver;
  }

  async function identityCheck(actor, verificationId, body, meta = {}) {
    await requireActivePharmacy(actor);
    const dob = v.birthDate(v.obj(body).dob, 'Geburtsdatum');
    const ver = await loadVerification(actor, verificationId);
    const rx = await rxs.findOne({ _id: ver.rxId });
    if (!rx || effectiveState(rx, ctx.now()) !== STATES.ISSUED) throw conflict('NOT_REDEEMABLE', 'Das Rezept ist nicht mehr einlösbar.');
    if (rx.dobLockedUntil && rx.dobLockedUntil > ctx.now()) throw tooMany('TEMP_LOCKED', 'Zu viele Fehlversuche. Das Rezept ist vorübergehend gesperrt.');

    const chains = [actor.orgId, rx.practiceOrgId];
    if (!safeEqual(vault.dobMac(rx.serial, dob), rx.dobMac)) {
      await rxs.updateOne({ _id: rx._id, state: STATES.ISSUED }, { $inc: { failedDobAttempts: 1 } });
      const fresh = await rxs.findOne({ _id: rx._id });
      const attempts = fresh.failedDobAttempts || 0;
      let locked = false;
      if (attempts >= DOB_MAX_ATTEMPTS) {
        locked = true;
        await rxs.updateOne({ _id: rx._id }, { $set: { failedDobAttempts: 0, dobLockedUntil: ctx.now() + DOB_LOCK_MS }, $push: { qsFlags: { type: 'DOB_FAILS', at: ctx.now(), orgId: actor.orgId } } });
        await notifications.create(rx.practiceOrgId, { type: 'DOB_FAILS', serial: rx.serial, message: `Mehrere Fehlversuche beim Identitätsabgleich für Rezept ${rx.serial}. Das Rezept wurde vorübergehend für die Einlösung gesperrt.` });
      }
      await ctx.audit.record({ chains, actor: actorOf(actor), action: 'VERIFY_IDENTITY_FAIL', result: 'FAIL', object: { type: 'prescription', serial: rx.serial }, detail: { attempts, locked }, ip: meta.ip, requestId: meta.requestId });
      if (locked) throw tooMany('TEMP_LOCKED', 'Zu viele Fehlversuche. Das Rezept ist vorübergehend gesperrt.');
      throw forbidden('IDENTITY_MISMATCH', 'Das Geburtsdatum stimmt nicht überein.');
    }

    await rxs.updateOne({ _id: rx._id }, { $set: { failedDobAttempts: 0 } });
    const plain = randomToken(32);
    const tokenDoc = await tokens.insertOne({
      _id: randomUUID(), tokenHash: sha256Hex(plain), verificationId: ver._id, rxId: rx._id, serial: rx.serial,
      pharmacyOrgId: actor.orgId, userId: actor._id, createdAt: ctx.now(), expiresAt: ctx.now() + TOKEN_TTL_MS, used: false,
    });
    const content = vault.decryptJson(rx.practiceOrgId, rx.contentEnc);
    const [practice, prescriber] = await Promise.all([orgs.findOne({ _id: rx.practiceOrgId }), users.findOne({ _id: rx.prescriberId })]);
    await ctx.audit.record({ chains, actor: actorOf(actor), action: 'VERIFY_IDENTITY_OK', object: { type: 'prescription', serial: rx.serial }, ip: meta.ip, requestId: meta.requestId });
    return {
      redemptionToken: plain, tokenExpiresAt: tokenDoc.expiresAt,
      content: {
        serial: rx.serial, patientName: content.patient.name, items: content.items, note: content.note || null,
        issuedAt: rx.issuedAt, expiresAt: rx.expiresAt, practiceName: practice ? practice.name : null,
        practiceAddress: practice ? practice.address || {} : {}, prescriberName: prescriber ? prescriber.name : null,
      },
    };
  }

  async function redeem(actor, body, meta = {}) {
    await requireActivePharmacy(actor);
    v.obj(body);
    const token = v.str(body.token, 'token', { max: 200 });
    const pickedUpBy = v.oneOf(body.pickedUpBy || 'PATIENT', 'pickedUpBy', ['PATIENT', 'TRUSTEE', 'THIRD']);
    const tokenHash = sha256Hex(token);

    // Token atomar verbrauchen: einmalig, an Nutzer/Apotheke gebunden, kurzlebig
    const claim = await tokens.updateOne(
      { tokenHash, used: false, pharmacyOrgId: actor.orgId, userId: actor._id, expiresAt: { $gt: ctx.now() } },
      { $set: { used: true, usedAt: ctx.now() } }
    );
    if (claim.modifiedCount !== 1) throw unauthorized('TOKEN_INVALID', 'Einlösetoken ungültig oder abgelaufen. Bitte Identität erneut abgleichen.');
    const tok = await tokens.findOne({ tokenHash });

    // Rezept atomar einlösen: nur wenn noch ausgestellt und nicht abgelaufen
    const done = await rxs.updateOne(
      { _id: tok.rxId, state: STATES.ISSUED, expiresAt: { $gt: ctx.now() } },
      { $set: { state: STATES.REDEEMED, redeemedAt: ctx.now(), redeemedByOrgId: actor.orgId, redeemedByUserId: actor._id, pickedUpBy, updatedAt: ctx.now() }, $inc: { version: 1 } }
    );
    const rx = await rxs.findOne({ _id: tok.rxId });
    if (done.modifiedCount !== 1) {
      await ctx.audit.record({ chains: [actor.orgId, rx && rx.practiceOrgId], actor: actorOf(actor), action: 'RX_REDEEM_REJECTED', result: 'FAIL', object: { type: 'prescription', serial: tok.serial }, ip: meta.ip, requestId: meta.requestId });
      throw conflict('NOT_REDEEMABLE', 'Das Rezept ist nicht (mehr) einlösbar.');
    }
    await ctx.audit.record({ chains: [actor.orgId, rx.practiceOrgId], actor: actorOf(actor), action: 'RX_REDEEMED', object: { type: 'prescription', id: rx._id, serial: rx.serial }, detail: { pickedUpBy }, ip: meta.ip, requestId: meta.requestId });
    const pharmacy = await orgs.findOne({ _id: actor.orgId });
    await notifications.create(rx.practiceOrgId, { type: 'REDEEMED', serial: rx.serial, message: `Rezept ${rx.serial} wurde eingelöst (${pharmacy ? pharmacy.name : 'Apotheke'}).` });
    return { serial: rx.serial, redeemedAt: rx.redeemedAt, cancelUntil: rx.redeemedAt + CANCEL_WINDOW_MS };
  }

  /** Einlösestorno innerhalb von 15 Minuten durch dieselbe Apotheke (z. B. Fehlbedienung). */
  async function cancelRedemption(actor, serialInput, body, meta = {}) {
    const parsed = parseSerial(serialInput);
    if (!parsed) throw badRequest('SERIAL_INVALID', 'Ungültige Rezept-ID.');
    const reason = v.str(v.obj(body).reason, 'reason', { max: 300 });
    const rx = await rxs.findOne({ serial: parsed.serial });
    if (!rx || rx.state !== STATES.REDEEMED || rx.redeemedByOrgId !== actor.orgId) throw notFound('RX_NOT_FOUND', 'Keine stornierbare Einlösung gefunden.');
    if (ctx.now() - rx.redeemedAt > CANCEL_WINDOW_MS) throw conflict('CANCEL_WINDOW_OVER', 'Das Storno-Zeitfenster von 15 Minuten ist abgelaufen. Bitte die Qualitätssicherung kontaktieren.');
    const r = await rxs.updateOne({ _id: rx._id, state: STATES.REDEEMED, redeemedByOrgId: actor.orgId }, {
      $set: { state: STATES.ISSUED, redeemedAt: null, redeemedByOrgId: null, redeemedByUserId: null, pickedUpBy: null, updatedAt: ctx.now() },
      $inc: { version: 1 },
      $push: { cancellations: { at: ctx.now(), userId: actor._id, orgId: actor.orgId } },
    });
    if (r.modifiedCount !== 1) throw conflict('CONFLICT', 'Das Rezept wurde zwischenzeitlich geändert.');
    await ctx.audit.record({ chains: [actor.orgId, rx.practiceOrgId], actor: actorOf(actor), action: 'REDEMPTION_CANCELLED', object: { type: 'prescription', id: rx._id, serial: rx.serial }, detail: { reason }, ip: meta.ip, requestId: meta.requestId });
    await notifications.create(rx.practiceOrgId, { type: 'REDEMPTION_CANCELLED', serial: rx.serial, message: `Die Einlösung von Rezept ${rx.serial} wurde storniert.` });
    return { serial: rx.serial, state: STATES.ISSUED };
  }

  async function listRedemptions(actor, { limit = 20 } = {}) {
    const rows = await rxs.find({ redeemedByOrgId: actor.orgId, state: STATES.REDEEMED }, { sort: { redeemedAt: -1 }, limit: Math.min(Number(limit) || 20, 100) });
    return rows.map((rx) => ({ serial: rx.serial, redeemedAt: rx.redeemedAt, pickedUpBy: rx.pickedUpBy, cancellable: ctx.now() - rx.redeemedAt <= CANCEL_WINDOW_MS }));
  }

  /** Verdachtsmeldung ("stiller Hinweis"): sperrt das Rezept und informiert Praxis und QS. */
  async function reportSuspicion(actor, body, meta = {}) {
    v.obj(body);
    const category = v.oneOf(body.category, 'category', REPORT_CATEGORIES);
    const note = v.str(body.note, 'note', { optional: true, max: 500 });
    const ver = await loadVerification(actor, body.verificationId);
    const rx = await rxs.findOne({ _id: ver.rxId });
    if (!rx) throw notFound('RX_NOT_FOUND', 'Rezept nicht gefunden.');
    const r = await rxs.updateOne({ _id: rx._id, state: STATES.ISSUED }, {
      $set: { state: STATES.BLOCKED, blockedBy: 'QS', blockReason: 'SUSPICION', blockedAt: ctx.now(), updatedAt: ctx.now() },
      $inc: { version: 1 },
      $push: { qsFlags: { type: 'PHARMACY_REPORT', category, note: note || null, at: ctx.now(), orgId: actor.orgId } },
    });
    await ctx.audit.record({ chains: [actor.orgId, rx.practiceOrgId, 'platform'], actor: actorOf(actor), action: 'QS_REPORT', object: { type: 'prescription', id: rx._id, serial: rx.serial }, detail: { category, blocked: r.modifiedCount === 1 }, ip: meta.ip, requestId: meta.requestId });
    await notifications.create(rx.practiceOrgId, { type: 'QS_REPORT', serial: rx.serial, message: `Rezept ${rx.serial} wurde von einer Apotheke als verdächtig gemeldet${r.modifiedCount === 1 ? ' und gesperrt' : ''}. Die Qualitätssicherung prüft den Fall.` });
    return { serial: rx.serial, blocked: r.modifiedCount === 1 };
  }

  return { check, identityCheck, redeem, cancelRedemption, listRedemptions, reportSuspicion, CANCEL_WINDOW_MS, REPORT_CATEGORIES };
}

module.exports = { createVerificationService };
