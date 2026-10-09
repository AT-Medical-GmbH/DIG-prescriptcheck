'use strict';

const crypto = require('crypto');
const { badRequest } = require('./errors');

/** Passwort-Hashing mit scrypt (Node-intern, keine zusätzliche Abhängigkeit). */

const R = 8;
const P = 1;
const KEYLEN = 64;

function scrypt(password, salt, N, r, p) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEYLEN, { N, r, p, maxmem: 256 * N * r }, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

async function hashPassword(password, N = 32768) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash, 'base64url');
  const key = await scrypt(password, Buffer.from(salt, 'base64url'), Number(N), Number(r), Number(p));
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

/** Passwortrichtlinie (Konzept 9.3): mindestens 12 Zeichen, nicht trivial. */
function assertPasswordPolicy(password, { email = '' } = {}) {
  const pw = String(password || '');
  const problems = [];
  if (pw.length < 12) problems.push('mindestens 12 Zeichen');
  if (pw.length > 128) problems.push('höchstens 128 Zeichen');
  if (!/[a-zäöüß]/.test(pw) || !/[A-ZÄÖÜ]/.test(pw) || !/\d/.test(pw)) problems.push('Groß- und Kleinbuchstaben sowie eine Ziffer');
  const local = String(email).split('@')[0].toLowerCase();
  if (local.length >= 4 && pw.toLowerCase().includes(local)) problems.push('darf den E-Mail-Namen nicht enthalten');
  if (problems.length) throw badRequest('WEAK_PASSWORD', `Passwort zu schwach: ${problems.join(', ')}.`);
}

function generatePassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  const pick = (set) => set[crypto.randomInt(set.length)];
  const chars = [pick(upper), pick(lower), pick(digits)];
  while (chars.length < 16) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

module.exports = { hashPassword, verifyPassword, assertPasswordPolicy, generatePassword };
