'use strict';

const crypto = require('crypto');

/**
 * Schlüsselring für Ed25519-Rezeptsignaturen.
 *  - `current`: Schlüssel-ID (1..255), mit der neu signiert wird
 *  - alte öffentliche Schlüssel bleiben zur Prüfung vorhanden (Rotation)
 */
class Keyring {
  /**
   * @param {{currentKid:number, privateKey:crypto.KeyObject, publicKeys?:Record<string,string>}} opts
   *   publicKeys: kid -> PEM (zusätzliche/alte Schlüssel)
   */
  constructor({ currentKid, privateKey, publicKeys = {} }) {
    if (!Number.isInteger(currentKid) || currentKid < 1 || currentKid > 255) {
      throw new Error('Schlüssel-ID muss eine ganze Zahl 1..255 sein');
    }
    this.currentKid = currentKid;
    this.privateKey = privateKey;
    this.publicKeysByKid = new Map();
    this.publicKeysByKid.set(currentKid, crypto.createPublicKey(privateKey));
    for (const [kid, pem] of Object.entries(publicKeys)) {
      if (Number(kid) !== currentKid) this.publicKeysByKid.set(Number(kid), crypto.createPublicKey(pem));
    }
  }

  sign(data) {
    return crypto.sign(null, data, this.privateKey);
  }

  verify(kid, data, signature) {
    const key = this.publicKeysByKid.get(kid);
    if (!key) return false;
    try {
      return crypto.verify(null, data, key, signature);
    } catch {
      return false;
    }
  }

  /** Öffentliche Schlüssel für /.well-known/prescriptcheck/keys */
  listPublic() {
    return [...this.publicKeysByKid.entries()].map(([kid, key]) => ({
      kid,
      alg: 'Ed25519',
      current: kid === this.currentKid,
      publicKeyPem: key.export({ type: 'spki', format: 'pem' }),
    }));
  }

  static generate(kid = 1) {
    const { privateKey } = crypto.generateKeyPairSync('ed25519');
    return new Keyring({ currentKid: kid, privateKey });
  }
}

module.exports = { Keyring };
