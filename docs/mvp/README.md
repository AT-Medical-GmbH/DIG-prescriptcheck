# PrescriptCheck – MVP: Stand, Bedienung und offene Punkte

**Stand:** 09.10.2026 · **Version:** 0.3.0 · Grundlage: [Gesamtkonzept](../konzept/PrescriptCheck_Gesamtkonzept.md), Phase 1 („MVP Verify“)

> **Einordnung:** Der MVP ist **funktional vollständig für den Kernablauf** (Ausstellen → Drucken → Prüfen → Identität abgleichen →
> Einlösen → Nachweisen) und automatisiert getestet. Er ist **nicht pilotreif**. Was bis zum Pilot noch fehlt, steht im Abschnitt
> [„Was bis zum Pilot fehlt“](#was-bis-zum-pilot-fehlt) – ehrlich und ohne Beschönigung.

## 1. Was der MVP kann

| Bereich | Funktion |
|---|---|
| **Praxis** | Rezept als Entwurf erfassen/ändern/verwerfen · verbindlich ausstellen (unveränderlich, Seriennummer, digitale Signatur) · Druck als PDF mit QR-Code · Duplikat-Kennzeichnung bei Nachdruck · Liste mit Status-Filter, Suche, Mehrfachauswahl · Einzel-/Mehrfachsperre, Entsperren mit Begründung · **Notfallsperre** aller offenen Rezepte · Mitteilungen bei Einlösung, Fehlversuchen, Verdachtsmeldungen |
| **Apotheke** | Rezept per Scanner/QR-Code oder Rezept-ID prüfen · **Ampel** (grün/gelb/rot, mit Symbol und Klartext) · Identitätsabgleich per Geburtsdatum (Inhalt erst danach sichtbar) · atomare Einlösung mit Einmal-Token · Einlösestorno (15 Min.) · **Verdachtsmeldung** (sperrt das Rezept, informiert Praxis und QS) |
| **Qualitätssicherung** | Liste gemeldeter/auffälliger Rezepte **ohne Patientendaten** · Sperre aufheben |
| **Verwaltung** | Organisationen (Praxis/Apotheke) anlegen und sperren · Nutzer anlegen/deaktivieren · **Zugang zurücksetzen** (Passwort, optional 2FA) · Rollen: Plattform-Admin, Supervisor, Auditor, Praxis-/Apotheken-Admin, Verordnende Person, Praxis-/Apothekenpersonal |
| **Nachweis** | Manipulationsgeschütztes Audit-Protokoll je Organisation mit Integritätsprüfung (Hash-Kette) |
| **Konto** | Login mit Sperre nach Fehlversuchen · Passwortwechsel · Zwei-Faktor-Authentifizierung (TOTP) · Pflicht-Einrichtung konfigurierbar |

## 2. Sicherheitsmerkmale (umgesetzt und getestet)

- **Fälschungsschutz:** Rezeptcode (131 Zeichen, QR) mit **Ed25519-Signatur**, ohne Patientendaten. Jede Manipulation bricht die Signatur; der Inhalt ist über einen gesalzenen Hash an den Code gebunden. Datenbank-Manipulationen am Inhalt werden bei der Prüfung erkannt (`INTEGRITY_FAILED`).
- **Einmaligkeit:** Einlösung nur über kurzlebiges (5 Min.), einmal verwendbares, an Nutzer/Apotheke gebundenes Token; Zustandswechsel als bedingtes Update → bei gleichzeitiger Einlösung durch mehrere Apotheken gewinnt **genau eine** (Test mit parallelen Anfragen).
- **Datenschutz:** Rezeptinhalt und Patientendaten **AES-256-GCM-verschlüsselt, Schlüssel je Mandant** (HKDF); Geburtsdatum nur als an die Rezept-ID gebundener HMAC – das Geburtsdatum wird nie ausgegeben; Abgleich statt Anzeige; keine Gesundheitsdaten in Logs, Audit, Benachrichtigungen und QS-Ansicht.
- **Zugriff:** Rechtematrix (jede Route × jede Rolle automatisiert getestet), strikte Mandantentrennung, Admin-Rollen ohne Zugriff auf Rezeptinhalte, serverseitige Sitzungsprüfung (Abmeldung/Sperre wirkt sofort), Refresh-Token-Rotation mit Wiederverwendungserkennung, Konto-Sperre, Rate-Limits, Passwortrichtlinie (scrypt), TOTP mit Replay-Schutz.
- **Nachweis:** HMAC-verkettetes, append-only Audit-Log; Manipulation, Löschung und Abschneiden werden erkannt; Schreibzugriffe auch bei Parallelität konsistent.
- **Betrieb:** In Produktion verweigert das Backend den Start ohne Geheimnisse, ohne MongoDB und mit Demo-Daten; HTTPS-Header, `Cache-Control: no-store` auf allen API-Antworten.

## 3. Aufbau des Repositorys

```
backend/src/            Backend (Node.js 22, Express 5, keine neuen Abhängigkeiten)
  config/               Konfiguration und Produktions-Prüfungen
  lib/                  Krypto, Signatur, Rezeptcode, QR-Encoder, PDF-Writer, TOTP, Passwort, Zustandsmaschine
  store/                Speicher-Store (Entwicklung/Test) und MongoDB-Store, gemeinsamer Vertragstest
  modules/              auth, admin, prescriptions, verification, qs, notifications, audit
  routes/               HTTP-Routen und Rechtematrix-Test
  testing/              Test-Harness (nicht im Produktions-Image)
frontend/app/           React-Oberfläche (Vite)
deploy/mvp/             Docker-Compose-Stack, NGINX, Backup-Skript, Server-Anleitung  (in Sandbox getestet, s. Kap. 5/9)
docs/konzept/           Gesamtkonzept
docs/adr/               Entscheidungen
```

**Altbestand:** Das frühere Gerüst (`backend/controllers|models|services|…`, `frontend/src`, `src/`, `docker/`, `config/`,
`deploy/helm|kubernetes|terraform` u. a.) wurde bewusst **nicht gelöscht** und wird vom MVP nicht verwendet. Es besteht überwiegend
aus leeren Dateien. Die Bereinigung ist ein eigener Schritt (Konzept, Anhang B) und wartet auf Freigabe.

## 4. Lokal starten (Demo mit erfundenen Daten)

```bash
# Backend (Speicher-Store: Daten sind nach dem Beenden weg)
cd backend && npm ci
STORE=memory SEED_DEMO=true SEED_DEMO_NO_PWCHANGE=1 npm start        # http://localhost:3000

# Frontend (Proxy auf das Backend)
cd frontend && npm ci && npm run dev                                   # http://localhost:5173
```

Demo-Konten (alle mit Passwort `Demo-Passwort-2026`, nur außerhalb von Produktion):

| E-Mail | Rolle |
|---|---|
| `arzt@demo.prescriptcheck.test` | Verordnende Person (Demo-Praxis) |
| `mfa@demo.prescriptcheck.test` | Praxispersonal |
| `praxisadmin@demo.prescriptcheck.test` | Praxis-Administration |
| `apotheker@demo.prescriptcheck.test` | Apotheker/in (Demo-Apotheke) |
| `apothekeadmin@demo.prescriptcheck.test` | Apotheken-Administration |
| `admin@demo.prescriptcheck.test` | Plattform-Administration |
| `qs@demo.prescriptcheck.test` / `auditor@demo.prescriptcheck.test` | QS-Supervisor / Auditor |

Ohne `SEED_DEMO_NO_PWCHANGE` müssen Demo-Nutzer beim ersten Login das Passwort ändern (wie in echten Konten).
Mit `REQUIRE_MFA=true` wird die Einrichtung der Zwei-Faktor-Authentifizierung erzwungen (Standard in Produktion).

## 5. Tests

```bash
cd backend && npm test              # 8 Suiten, 456 Tests (Rechtematrix, Nebenläufigkeit, Manipulation, QR-Referenzvergleich, …)
cd frontend && npm test && npm run lint && npm run build
MONGODB_URI_TEST=mongodb://… npm test   # gesamte Suite gegen echte MongoDB (je Harness eigene Test-DB, wird nachher gelöscht): 464 Tests
```

Zusätzlich wurde der Ablauf im Browser (Chromium/Playwright) durchgespielt: Praxis stellt aus → Apotheke prüft, gleicht ab, löst ein →
erneute Prüfung ist rot → Praxis sieht die Einlösung → Audit-Kette intakt → Nutzer anlegen und Zugang zurücksetzen.

**Gegen echte MongoDB 7:** Die gesamte Backend-Suite (464 Tests inkl. 8 Store-Vertragstests) läuft grün gegen eine echte MongoDB 7. Indizes (u. a. eindeutige
Seriennummer, `chain+seq` im Audit-Log, `tokenHash`) wurden in der laufenden Datenbank geprüft. In der Datenbank finden sich keine Klartext-Patientendaten
(Suche nach Name, Medikament und Geburtsdatum in allen Collections: 0 Treffer).

**Docker-Stack (Sandbox, erfundene Daten):** Images gebaut, Stack mit Mongo (Auth), Backend (nicht-root) und NGINX (TLS, Sicherheits-Header, HTTP→HTTPS, SPA-Fallback,
Rate-Limit 429, Mongo nicht von außen erreichbar) gestartet; Neustart des Backends behält die Daten. Backup (`mongodump` + AES-256) und Restore in eine
Nebendatenbank liefern identische Dokumentzahlen. Vollständiger Browser-Durchlauf über NGINX mit Pflicht-MFA ohne CSP-/JS-Fehler; beide Audit-Ketten intakt.
**Einschränkung:** Sandbox mit selbstsigniertem Zertifikat und Sandbox-CA-Shim für den Image-Build – kein echter Server, kein Let's-Encrypt-Lauf.

**QR-Code unabhängig gelesen:** Aus dem gerenderten PDF dekodiert ein unabhängiger Decoder (zxing-cpp) den Code korrekt, auch in 13 von 14 künstlich
verschlechterten Varianten (Verkleinerung, Unschärfe, Rauschen, Kontrastverlust u. Ä.). Das ersetzt **keinen** Test mit echten Scannern und Handy-Kameras.

**QR-Encoder:** eigene Implementierung, bitgenau gegen den unabhängigen Referenz-Encoder `reportlab` geprüft (Versionen 1–15, alle 8 Masken,
minimale und maximale Nutzlast; Fixtures in `backend/src/lib/qr.fixtures.json`).

## 6. Konfiguration (Umgebungsvariablen)

| Variable | Bedeutung | Pflicht in Produktion |
|---|---|---|
| `NODE_ENV` | `production` aktiviert alle Schutzprüfungen | – |
| `STORE` / `MONGODB_URI` | `mongo` bzw. `memory` (in Produktion nur `mongo`) | ja (`MONGODB_URI`) |
| `JWT_SECRET` | ≥ 32 Zeichen | ja |
| `MASTER_KEY` | Base64, 32 Byte – Schlüssel für Feldverschlüsselung, Geburtsdatum-MAC, Audit-HMAC | ja |
| `SIGNING_PRIVATE_KEY`, `SIGNING_KEY_ID`, `SIGNING_PUBLIC_KEYS_JSON` | Ed25519-Signaturschlüssel (PEM oder Base64-PEM), Rotation | ja |
| `REQUIRE_MFA` | 2FA-Pflicht (Standard: an in Produktion) | – |
| `RX_VALIDITY_DAYS` | Standard-Gültigkeit (Platzhalter 28 – **rechtlich zu klären**) | – |
| `TRUST_PROXY` | Anzahl vorgeschalteter Proxys (für Client-IP im Audit) | im Compose-Stack gesetzt |
| `CORS_ORIGINS` | nur nötig, wenn Frontend und API auf verschiedenen Ursprüngen liegen | – |

Erzeugung der Geheimnisse: `cd backend && npm run keys`. Erstes Admin-Konto: `npm run admin:create` (siehe [Server-Anleitung](../../deploy/mvp/README.md)).

## 7. API-Überblick (`/api/v1`)

| Bereich | Endpunkte |
|---|---|
| Konto | `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me`, `POST /auth/change-password`, `/auth/mfa/enroll`, `/auth/mfa/confirm` |
| Verwaltung | `GET/POST /admin/organizations`, `PATCH /admin/organizations/:id`, `GET/POST /admin/users`, `GET/POST /org/users`, `PATCH /users/:id/status`, `POST /users/:id/reset-credentials` |
| Praxis | `GET/POST /prescriptions`, `GET/PUT /prescriptions/:id`, `POST …/issue`, `…/block`, `…/unblock`, `…/discard`, `GET …/pdf`, `POST /prescriptions/block-bulk`, `/prescriptions/block-all-open` |
| Apotheke | `POST /verifications`, `POST /verifications/:id/identity-check`, `POST /redemptions`, `GET /redemptions`, `POST /redemptions/:serial/cancel`, `POST /qs/reports` |
| QS / Audit | `GET /qs/flagged`, `POST /qs/prescriptions/:serial/unblock`, `GET /audit`, `GET /audit/verify`, `GET/POST /notifications…` |
| Öffentlich | `GET /.well-known/prescriptcheck/keys` (öffentliche Signaturschlüssel), `GET /healthz`, `/readyz` |

Fehler haben das Format `{ "error": { "code", "message" }, "requestId" }`. Eine OpenAPI-Spezifikation ist noch nicht erstellt.

## 8. Abweichungen vom Konzept (bewusst)

| Konzept | MVP | Grund |
|---|---|---|
| TypeScript (Kap. 13.3) | JavaScript (CommonJS/ESM) | Kein Build-Schritt, keine neuen Abhängigkeiten; Umstellung später möglich |
| `src/backend` als Basis (ADR-09) | `backend/src` | Dort liegen `package.json`, Lockfile und CI-Anbindung; `src/` bleibt Altbestand |
| FIDO2/WebAuthn (Kap. 9.3) | TOTP | Geringerer Aufwand; WebAuthn folgt |
| Refresh-Token als httpOnly-Cookie | Refresh-Token in `sessionStorage` (nur Browser-Sitzung), Access-Token im Speicher | Einfachere Umsetzung; strikte CSP mindert das XSS-Risiko; Umstellung auf Cookie empfohlen |
| `iss` (Praxis) im Rezeptcode (Kap. 6.4) | nicht im Code, Zuordnung über Seriennummer | Code bleibt kompakt (QR Version 8) |
| QR **und** PDF417 | nur QR | PDF417-Encoder nicht umgesetzt; Scanner mit 2D-Unterstützung lesen QR, Fallback Rezept-ID |
| Inhalt vor Identitätsabgleich sichtbar (Konzept 7.3 Skizze) | Inhalt **erst nach** erfolgreichem Abgleich | Strengerer Datenschutz (nur Code-Besitz reicht nicht für Einsicht) |
| Seriennummer bei Anlage | Seriennummer **erst beim Ausstellen** | Jahr ergibt sich aus Ausstellungszeitpunkt; Entwürfe haben keine Nummer |

## 9. Was bis zum Pilot fehlt

### A. Muss vor jedem Echtbetrieb erledigt sein

| # | Punkt | Warum |
|---|---|---|
| A1 | ~~MongoDB-Store gegen echte MongoDB testen~~ **erledigt** (464 Tests gegen MongoDB 7, Indizes und Klartext-Freiheit geprüft) | Auf dem Zielserver mit der dort eingesetzten MongoDB-Version einmal wiederholen |
| A2 | **Docker-Stack auf einem echten Staging-Server** in Betrieb nehmen (echtes Let's-Encrypt-Zertifikat, Firewall, Backup per Cron, Restore-Übung) | In der Sandbox bereits funktional geprüft (s. Kap. 5), aber nicht auf dem Zielserver |
| A3 | **Praxistest mit echtem Drucker, Handy-Kamera und Apotheken-Scanner** | QR-Code ist gegen Referenz-Encoder und unabhängigen Decoder geprüft, aber nicht mit realen Lesegeräten/Druckern; PDF417 fehlt |
| A4 | **Externer Penetrationstest** und Behebung der Befunde | Konzept: Pflicht vor Pilot |
| A5 | **DSFA, Verzeichnis der Verarbeitungstätigkeiten, AVV, Datenschutzerklärung, AGB/SLA** | Rechtliche Voraussetzungen (Konzept Kap. 11/12); anwaltliche Prüfung |
| A6 | **Rechtliche Klärung** Pflichtangaben, Gültigkeitsdauer (Platzhalter 28 Tage), Hybridmodell Papier+Code, Datenschutzrollen | Konzept ADR-06/ADR-11 |
| A7 | **Server-Härtung und Betrieb:** Firewall, VPN/Bastion, Updates, Monitoring/Alarme, **getesteter Restore**, Offline-Sicherung von `MASTER_KEY`/`SIGNING_PRIVATE_KEY` | Konzept Kap. 9.7/17 |
| A8 | **`.env.production` im Git prüfen** (Schlüsselnamen für Zahlungsdienste etc.); bei echten Werten rotieren und aus der Historie entfernen | Konzept ADR-14; Inhalt wurde nicht gelesen |
| A9 | GitHub-Actions wieder lauffähig machen (Abrechnung/Ausgabenlimit) und Workflows konsolidieren | CI war bei Erstellung rot, ohne dass Jobs starteten |

### B. Fachlich/technisch noch nicht umgesetzt (laut Konzept Phase 2+)

- Gegensignatur/Vier-Augen, Break-Glass, Sicherheitsstufen, zeitlich begrenzte Freigaben; QS-Entsperrung durch **eine** Person
- Externe Zeitstempel (RFC 3161) und WORM-Archiv für das Audit-Log – die Kette liegt in derselben Datenbank; wer `MASTER_KEY` **und** Datenbank-Schreibzugriff hat, könnte sie neu berechnen
- Löschkonzept, Aufbewahrungsfristen, Betroffenenrechte (Auskunft/Löschung)
- Gerätebindung, FIDO2/WebAuthn, E-Mail-Versand (Passwort-Reset per Mail, Benachrichtigungen) – bis dahin Zugang zurücksetzen durch Administratoren
- Patientenportal und Vertrauensperson (erfasst wird nur „Abholung durch“), Teileinlösung
- Lizenzen, Zahlung, Rechnungen (Stripe), Testlizenz, Mahnwesen
- QS-Score, Anomalieerkennung (vorhanden: Sperre nach 3 Fehlversuchen, Verdachtsmeldung), Live-Monitor
- Schulungen/SCORM, Praxis-Widget, Formularbestellung, Tiramizoo, TI-Anbindung, FHIR-Export, Mehrsprachigkeit (nur Deutsch), Barrierefreiheitsprüfung (WCAG) offen
- OpenAPI-Dokumentation, Paginierung großer Listen (Rezeptliste lädt bis zu 500 Einträge), Lasttests

### C. Bekannte Risiken und Abwägungen

- **Verdachtsmeldung kann missbraucht werden:** Eine Apotheke kann ein Rezept sperren, das sie zuvor geprüft hat. Jede Meldung ist protokolliert, Praxis und QS werden informiert; die QS kann entsperren. Bei ernsthaftem Missbrauch sind Konto-Sperre und Sanktionen vertraglich zu regeln.
- **Konto-Sperre nach 5 Fehlversuchen** kann von Dritten für einen Nutzer ausgelöst werden (Denial-of-Service gegen ein Konto). Gegenmaßnahmen: IP-Rate-Limit, Administratoren können Sperren aufheben (Zugang zurücksetzen).
- **Erste Prüfung bei Ausfall des Servers:** Es gibt noch keinen Offline-Modus. Bei Ausfall bleibt die Apotheke bei der üblichen Prüfung (Konzept 7.3 beschreibt den Ausfallbetrieb als späteres Ziel).
