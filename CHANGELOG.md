# Changelog – DIG-prescriptcheck / PrescriptCheck

All notable changes to this project are documented in this file.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **MVP „Verify“** (Konzept Phase 1), siehe `docs/mvp/README.md`: Ausstellen, Drucken, Prüfen, Identitätsabgleich und Einlösung von Privatrezepten
  - Backend `backend/src`: Ed25519-signierter Rezeptcode ohne Patientendaten, eigener QR-Encoder (gegen Referenz geprüft) und PDF-Writer, Zustandsmaschine,
    atomare Einlösung, Feldverschlüsselung je Mandant, HMAC-verkettetes Audit-Log, Login mit Sperre/Refresh-Rotation/TOTP, Rechtematrix, Mandantentrennung
  - Frontend `frontend/app` (React/Vite): Praxis-, Apotheken-, QS-, Verwaltungs- und Audit-Ansichten
  - Betrieb `deploy/mvp`: Docker-Compose-Stack, NGINX, Backup-Skript, Server-Anleitung (in Sandbox getestet)
  - Tests: 456 Backend-Tests im Speicher-Store, 464 gegen echte MongoDB 7, 4 Frontend-Tests; QR unabhängig dekodiert (zxing-cpp)
  - Fix: Login-/Refresh-Limiter zählt nur Fehlversuche; NGINX: doppelte Header, Cache-Control, 429 statt 503
- `docs/konzept/PrescriptCheck_Gesamtkonzept.md` – Gesamtkonzept; `docs/adr/0001-mvp-entscheidungen.md`

### Added (Governance, zuvor)
- Enterprise metadata: `metadata/repository-profile.yml` with ATMED governance tags
- `LICENSE` root file referencing `LICENSE_COMMERCIAL.md`
- `.github/dependabot.yml` for automated dependency security updates
- Additional governance workflows: governance-check, tagging-validation, repo-self-check, safe-cleanup, dependency-scan
- `configs/` and `artifacts/` directory markers for CI/CD pipeline standardization
- `.gitignore` rule excluding build artifacts from `artifacts/` while keeping `README.md` marker
- `Abschlussbericht_PrescriptCheck.md` – project completion report

### Changed
- `README.md`: fixed malformed security badge URL; aligned env template filename to `.env.example`
- `CODEOWNERS`: complete team-based ownership with security and compliance coverage
- `CHANGELOG.md`: updated to enterprise Keep-a-Changelog format
- `audit.yml`: uses `working-directory`, `npm ci`, and `setup-node` npm caching (consistent with `ci.yml`)

---

## [0.9.0] – 2026-03-16

### Added
- Enterprise repository standardization (AT Medical Enterprise Repository Standard)
- `metadata/repository-profile.yml` — canonical repository metadata
- `metadata/tags/` — global tagging taxonomy, rules, examples and file registry
- Enterprise directory structure: `configs/`, `status/`, `templates/`, `artifacts/`
- `.github/workflows/file-tagging.yml` — automated tag validation workflow
- `.github/workflows/ci-validation.yml` — CI structure validation
- `.github/workflows/governance-check.yml` — governance compliance check
- `.github/workflows/tag-validation.yml` — standalone tag validation
- `.github/workflows/dependency-check.yml` — dependency health check
- `.github/workflows/cleanup-weekly.yml` — weekly cleanup automation
- `.github/workflows/repository-selfcheck.yml` — repository health check
- `.github/dependabot.yml` — automated dependency updates
- `scripts/validate/repository-selfcheck.sh` — repository self-check script
- Enterprise verification blocks in all documentation files
- Artifact intake directories (`artifacts/incoming`, `artifacts/staged`, `artifacts/releases`)

### Changed
- `README.md` — enterprise badges and verification block added
- `CONTRIBUTING.md` — enterprise verification block added
- `SECURITY.md` — enterprise verification block added
- `CODE_OF_CONDUCT.md` — enterprise verification block added

---

## [0.2.0] – 2025-05-XX

### Added
- Videosprechstunde integriert
- Export verschlüsselter Prüfberichte

---

## [0.1.0] – 2025-05-14

### Added
- Initiales Release: Rezeptvalidierung, Apothekenportal, Lizenzsystem
