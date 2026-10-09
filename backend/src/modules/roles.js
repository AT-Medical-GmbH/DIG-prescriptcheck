'use strict';

/**
 * Rollenmodell (Konzept 8). Plattformrollen haben keine Organisation, alle
 * anderen sind genau einer Praxis oder Apotheke zugeordnet.
 */
const ROLES = Object.freeze({
  PLATFORM_ADMIN: 'PLATFORM_ADMIN', // Organisationen/Nutzer verwalten – KEIN Zugriff auf Rezeptinhalte
  SUPERVISOR: 'SUPERVISOR', // QS: gemeldete/gesperrte Rezepte bearbeiten (ohne Inhalte)
  AUDITOR: 'AUDITOR', // lesend: Audit-Trail
  PRACTICE_ADMIN: 'PRACTICE_ADMIN',
  PRESCRIBER: 'PRESCRIBER',
  PRACTICE_STAFF: 'PRACTICE_STAFF',
  PHARMACY_ADMIN: 'PHARMACY_ADMIN',
  PHARMACIST: 'PHARMACIST',
  PHARMACY_STAFF: 'PHARMACY_STAFF',
});

const ORG_TYPES = Object.freeze({ PRACTICE: 'PRACTICE', PHARMACY: 'PHARMACY' });

const PLATFORM_ROLES = [ROLES.PLATFORM_ADMIN, ROLES.SUPERVISOR, ROLES.AUDITOR];
const PRACTICE_ROLES = [ROLES.PRACTICE_ADMIN, ROLES.PRESCRIBER, ROLES.PRACTICE_STAFF];
const PHARMACY_ROLES = [ROLES.PHARMACY_ADMIN, ROLES.PHARMACIST, ROLES.PHARMACY_STAFF];

const rolesForOrgType = (type) => (type === ORG_TYPES.PRACTICE ? PRACTICE_ROLES : PHARMACY_ROLES);
const isPlatformRole = (role) => PLATFORM_ROLES.includes(role);

module.exports = { ROLES, ORG_TYPES, PLATFORM_ROLES, PRACTICE_ROLES, PHARMACY_ROLES, rolesForOrgType, isPlatformRole };
