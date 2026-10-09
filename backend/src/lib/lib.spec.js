'use strict';

const crypto = require('crypto');
const { generateSerial, parseSerial, checkChar, encodeBase32, decodeBase32 } = require('./ids');
const { Keyring } = require('./signing');
const { encodeCode, decodeCode } = require('./rxCode');
const { createVault, canonicalJson } = require('./crypto');
const { verifyTotp, hotp, stepAt, base32Decode, base32Encode } = require('./totp');
const { hashPassword, verifyPassword, assertPasswordPolicy, generatePassword } = require('./password');
const { effectiveState, canTransition, STATES } = require('./stateMachine');
const v = require('./validate');
const { PdfDoc } = require('./pdf');

describe('Seriennummern', () => {
  test('Format, Prüfzeichen und Rundlauf', () => {
    const { serial, raw } = generateSerial(Date.UTC(2026, 5, 1));
    expect(serial).toMatch(/^PC-26-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]$/);
    const parsed = parseSerial(serial);
    expect(parsed.serial).toBe(serial);
    expect(decodeBase32(encodeBase32(raw)).equals(raw)).toBe(true);
  });

  test('tolerante Eingabe: Kleinschreibung, Leerzeichen, O/0 und I/L/1', () => {
    const base = parseSerial('PC-26-7KQ4-M9XT-R2'.replace(/-R2$/, `-${checkChar('267KQ4M9XT')}`));
    expect(base).not.toBeNull();
    const messy = base.serial.toLowerCase().replace(/-/g, ' ');
    expect(parseSerial(messy).serial).toBe(base.serial);
  });

  test('Tippfehler werden erkannt', () => {
    const { serial } = generateSerial();
    const chars = serial.split('');
    const i = serial.length - 3;
    chars[i] = chars[i] === '7' ? '8' : '7';
    expect(parseSerial(chars.join(''))).toBeNull();
    expect(parseSerial('quatsch')).toBeNull();
    expect(parseSerial(null)).toBeNull();
  });

  test('Seriennummern sind eindeutig (10.000 Stück)', () => {
    const set = new Set();
    for (let i = 0; i < 10000; i++) set.add(generateSerial().serial);
    expect(set.size).toBe(10000);
  });
});

describe('Rezeptcode', () => {
  const keyring = Keyring.generate(7);
  const make = () => {
    const { serial, raw } = generateSerial(Date.UTC(2026, 9, 9));
    const hashHex = crypto.randomBytes(32).toString('hex');
    const iatSec = Math.floor(Date.UTC(2026, 9, 9) / 1000);
    const code = encodeCode({ kid: 7, iatSec, expSec: iatSec + 86400, serialRaw: raw, hashHex }, keyring);
    return { serial, hashHex, iatSec, code };
  };

  test('Rundlauf liefert Seriennummer, Zeiten und Hash-Präfix', () => {
    const { serial, hashHex, iatSec, code } = make();
    expect(code).toHaveLength(131);
    const dec = decodeCode(code, keyring);
    expect(dec).toMatchObject({ ok: true, kid: 7, serial, iatSec, expSec: iatSec + 86400, hashPrefix: hashHex.slice(0, 32) });
  });

  test('jede Manipulation macht die Signatur ungültig', () => {
    const { code } = make();
    const body = Buffer.from(code.slice(4), 'base64url');
    for (const pos of [2, 6, 10, 15, 30, 31, 94]) {
      const t = Buffer.from(body);
      t[pos] ^= 1;
      const r = decodeCode(`PC1:${t.toString('base64url')}`, keyring);
      expect(r.ok).toBe(false);
      expect(r.reason).toBe('SIGNATURE');
    }
  });

  test('fremder Schlüssel, falsches Format, abgeschnittener Code', () => {
    const { code } = make();
    expect(decodeCode(code, Keyring.generate(7)).reason).toBe('SIGNATURE');
    expect(decodeCode(code, Keyring.generate(9)).reason).toBe('SIGNATURE');
    expect(decodeCode('PC2:abc', keyring).reason).toBe('FORMAT');
    expect(decodeCode(code.slice(0, -3), keyring).reason).toBe('FORMAT');
    expect(decodeCode(undefined, keyring).reason).toBe('FORMAT');
    expect(decodeCode(`${code}!`, keyring).reason).toBe('FORMAT');
  });

  test('Schlüsselrotation: alte Codes bleiben mit altem öffentlichem Schlüssel prüfbar', () => {
    const oldRing = Keyring.generate(1);
    const { serial, raw } = generateSerial();
    const iatSec = Math.floor(Date.now() / 1000);
    const code = encodeCode({ kid: 1, iatSec, expSec: iatSec + 60, serialRaw: raw, hashHex: 'a'.repeat(64) }, oldRing);
    const newRing = new Keyring({ currentKid: 2, privateKey: Keyring.generate(2).privateKey, publicKeys: { 1: oldRing.listPublic()[0].publicKeyPem } });
    expect(decodeCode(code, newRing)).toMatchObject({ ok: true, serial });
    expect(() => encodeCode({ kid: 1, iatSec, expSec: iatSec + 60, serialRaw: raw, hashHex: 'a'.repeat(64) }, newRing)).toThrow();
  });
});

describe('Vault', () => {
  const vault = createVault(crypto.randomBytes(32));

  test('Verschlüsselung ist mandantengebunden', () => {
    const token = vault.encrypt('org-a', 'Max Mustermann');
    expect(token).not.toContain('Max');
    expect(vault.decrypt('org-a', token)).toBe('Max Mustermann');
    expect(() => vault.decrypt('org-b', token)).toThrow();
  });

  test('Manipulation am Chiffrat wird erkannt, IV ist zufällig', () => {
    const t1 = vault.encrypt('o', 'x');
    expect(vault.encrypt('o', 'x')).not.toBe(t1);
    const buf = Buffer.from(t1.slice(3), 'base64url');
    buf[buf.length - 1] ^= 1;
    expect(() => vault.decrypt('o', `v1.${buf.toString('base64url')}`)).toThrow();
  });

  test('Geburtsdatum-MAC ist an die Seriennummer gebunden', () => {
    expect(vault.dobMac('S1', '1980-01-01')).toBe(vault.dobMac('S1', '1980-01-01'));
    expect(vault.dobMac('S1', '1980-01-01')).not.toBe(vault.dobMac('S2', '1980-01-01'));
    expect(vault.dobMac('S1', '1980-01-01')).not.toBe(vault.dobMac('S1', '1980-01-02'));
  });

  test('kanonisches JSON ist reihenfolgeunabhängig', () => {
    expect(canonicalJson({ b: 1, a: [2, { d: 1, c: undefined }] })).toBe(canonicalJson({ a: [2, { d: 1 }], b: 1 }));
  });

  test('falsche Schlüssellänge wird abgelehnt', () => {
    expect(() => createVault(Buffer.alloc(16))).toThrow();
  });
});

describe('TOTP', () => {
  const secret = base32Encode(Buffer.from('12345678901234567890'));
  test('RFC-6238-Testvektor (t=59 s → …287082)', () => {
    expect(hotp(secret, 1)).toBe('287082');
    expect(verifyTotp(secret, '287082', 59_000)).toBe(1);
  });
  test('Fenster ±1 Schritt, sonst abgelehnt', () => {
    const t = 1_700_000_000_000;
    const code = hotp(secret, stepAt(t));
    expect(verifyTotp(secret, code, t + 30_000)).toBe(stepAt(t));
    expect(verifyTotp(secret, code, t + 120_000)).toBeNull();
    expect(verifyTotp(secret, 'abc123', t)).toBeNull();
  });
  test('Base32-Rundlauf', () => {
    const b = Buffer.from('hallo welt');
    expect(base32Decode(base32Encode(b)).equals(b)).toBe(true);
  });
});

describe('Passwörter', () => {
  test('Hash/Prüfung', async () => {
    const h = await hashPassword('Geheim-Passwort-123', 1024);
    expect(await verifyPassword('Geheim-Passwort-123', h)).toBe(true);
    expect(await verifyPassword('falsch', h)).toBe(false);
    expect(await verifyPassword('x', 'kaputt')).toBe(false);
  });
  test('Richtlinie', () => {
    expect(() => assertPasswordPolicy('kurz1A')).toThrow(/12 Zeichen/);
    expect(() => assertPasswordPolicy('nurkleinbuchstaben')).toThrow();
    expect(() => assertPasswordPolicy('Maria-Passwort-1', { email: 'maria@x.de' })).toThrow(/E-Mail/);
    expect(() => assertPasswordPolicy('Sicheres-Passwort-1')).not.toThrow();
  });
  test('generierte Passwörter erfüllen die Richtlinie', () => {
    for (let i = 0; i < 50; i++) expect(() => assertPasswordPolicy(generatePassword())).not.toThrow();
  });
});

describe('Zustandsmaschine', () => {
  test('erlaubte und verbotene Übergänge', () => {
    expect(canTransition('DRAFT', 'ISSUED')).toBe(true);
    expect(canTransition('ISSUED', 'REDEEMED')).toBe(true);
    expect(canTransition('REDEEMED', 'BLOCKED')).toBe(false);
    expect(canTransition('DISCARDED', 'ISSUED')).toBe(false);
    expect(canTransition('ISSUED', 'DRAFT')).toBe(false);
  });
  test('Ablauf ist abgeleitet', () => {
    const rx = { state: 'ISSUED', expiresAt: 1000 };
    expect(effectiveState(rx, 999)).toBe(STATES.ISSUED);
    expect(effectiveState(rx, 1000)).toBe(STATES.EXPIRED);
    expect(effectiveState({ ...rx, state: 'BLOCKED' }, 5000)).toBe(STATES.BLOCKED);
  });
});

describe('Validierung', () => {
  test('Geburtsdatum', () => {
    expect(v.birthDate('1980-05-17')).toBe('1980-05-17');
    expect(() => v.birthDate('1980-02-30')).toThrow();
    expect(() => v.birthDate('2999-01-01')).toThrow(/Zukunft/);
    expect(() => v.birthDate('17.05.1980')).toThrow();
    expect(() => v.birthDate('1800-01-01')).toThrow();
  });
  test('Text: Steuerzeichen raus, Länge geprüft', () => {
    expect(v.str('  a\u0000b  ', 'x')).toBe('ab');
    expect(() => v.str('', 'x')).toThrow();
    expect(() => v.str('a'.repeat(300), 'x', { max: 200 })).toThrow();
    expect(() => v.str(42, 'x')).toThrow();
    expect(v.str(undefined, 'x', { optional: true })).toBeUndefined();
  });
  test('E-Mail wird normalisiert', () => {
    expect(v.email('  Arzt@Praxis.DE ')).toBe('arzt@praxis.de');
    expect(() => v.email('kein-email')).toThrow();
  });
});

describe('PDF-Writer', () => {
  test('erzeugt wohlgeformtes PDF mit korrekter xref-Tabelle', () => {
    const doc = new PdfDoc({ title: 'Test äöü €' });
    const p = doc.addPage();
    p.text(50, 50, 'Grüße (Klammern) \\ äöüß €', { bold: true });
    p.rect(10, 10, 20, 20, { fill: true });
    p.qr(100, 100, 100, [[true, false], [false, true]]);
    const buf = doc.toBuffer();
    const s = buf.toString('latin1');
    expect(s.startsWith('%PDF-1.4')).toBe(true);
    expect(s.trimEnd().endsWith('%%EOF')).toBe(true);
    const xrefPos = Number(/startxref\n(\d+)/.exec(s)[1]);
    expect(s.slice(xrefPos, xrefPos + 4)).toBe('xref');
    // jeder xref-Eintrag zeigt auf "<n> 0 obj"
    const entries = [...s.slice(xrefPos).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(entries.length).toBeGreaterThan(5);
    entries.forEach((off, i) => expect(s.startsWith(`${i + 1} 0 obj\n`, off)).toBe(true));
  });
});
