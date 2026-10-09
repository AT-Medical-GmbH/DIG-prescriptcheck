'use strict';

/**
 * Sammlungen und Indizes. Eindeutigkeit wird von beiden Store-Implementierungen
 * (Speicher/MongoDB) durchgesetzt.
 */
const COLLECTIONS = {
  organizations: { unique: [['name']], indexes: [] },
  users: { unique: [['email']], indexes: [['orgId']] },
  sessions: { unique: [], indexes: [['userId']] },
  prescriptions: {
    unique: [['serial']], // serial fehlt bei Entwürfen -> sparse
    sparseUnique: true,
    indexes: [['practiceOrgId', 'createdAt'], ['practiceOrgId', 'state']],
  },
  verifications: { unique: [], indexes: [['serial']] },
  redemption_tokens: { unique: [['tokenHash']], indexes: [] },
  audit: { unique: [['chain', 'seq']], indexes: [] },
  audit_heads: { unique: [], indexes: [] },
  notifications: { unique: [], indexes: [['orgId', 'createdAt']] },
};

module.exports = { COLLECTIONS };
