# PrescriptCheck – Gesamtkonzept

**Fachliches, technisches, regulatorisches und betriebliches Zielkonzept**

| Feld | Wert |
|---|---|
| Dokument | PrescriptCheck – Gesamtkonzept |
| Version | 1.0 (Entwurf zur Freigabe) |
| Stand | 09.10.2026 |
| Herausgeber | AT Medical GmbH |
| Verantwortlich | Dr. Andreas Tremml (Projektleitung) |
| Klassifizierung | Intern – Vertraulich |
| Status | Entwurf – Entscheidungen in Kapitel 20 offen |
| Grundlage | Handover „Projekt PrescriptCheck Zusammenfassung" (Anforderungsstand Mai 2025) und Bestandsprüfung des Repositorys `DIG-prescriptcheck` (Branch `main`, Commit `5a26100`) |

> **Lesehinweis zur Belastbarkeit.** Das Dokument trennt konsequent zwischen
> **[GESICHERT]** – im Repository nachgewiesen,
> **[HISTORISCH]** – aus dem Handover übernommen, nicht verifiziert,
> **[ZIELBILD]** – in diesem Konzept festgelegte Soll-Architektur,
> **[OFFEN]** – Entscheidung oder Prüfung ausstehend.
> Rechtliche Aussagen sind fachliche Einordnungen und **ersetzen keine anwaltliche, pharmazierechtliche oder datenschutzrechtliche Prüfung**. Wo eine solche Prüfung nötig ist, ist das ausdrücklich markiert.

---

## Inhaltsverzeichnis

1. [Management Summary](#1-management-summary)
2. [Ausgangslage und Bestandsaufnahme](#2-ausgangslage-und-bestandsaufnahme)
3. [Problemstellung, Vision und Produktpositionierung](#3-problemstellung-vision-und-produktpositionierung)
4. [Scope und Abgrenzung](#4-scope-und-abgrenzung)
5. [Stakeholder, Akteure und Nutzungskontexte](#5-stakeholder-akteure-und-nutzungskontexte)
6. [Fachkonzept: Rezeptlebenszyklus](#6-fachkonzept-rezeptlebenszyklus)
7. [Fachkonzept: Kernprozesse](#7-fachkonzept-kernprozesse)
8. [Rollen-, Rechte- und Freigabemodell](#8-rollen--rechte--und-freigabemodell)
9. [Sicherheitskonzept](#9-sicherheitskonzept)
10. [Qualitätssicherung, Anomalieerkennung und Missbrauchsabwehr](#10-qualitätssicherung-anomalieerkennung-und-missbrauchsabwehr)
11. [Datenschutzkonzept](#11-datenschutzkonzept)
12. [Regulatorische Einordnung und Compliance](#12-regulatorische-einordnung-und-compliance)
13. [Technische Zielarchitektur](#13-technische-zielarchitektur)
14. [Datenmodell](#14-datenmodell)
15. [API- und Integrationskonzept](#15-api--und-integrationskonzept)
16. [Lizenz-, Zahlungs- und Geschäftsmodell](#16-lizenz--zahlungs--und-geschäftsmodell)
17. [Betrieb, Infrastruktur und Notfallkonzept](#17-betrieb-infrastruktur-und-notfallkonzept)
18. [Qualitäts-, Test- und Release-Konzept](#18-qualitäts--test--und-release-konzept)
19. [UI/UX-, Kommunikations- und Dokumentationskonzept](#19-uiux--kommunikations--und-dokumentationskonzept)
20. [Entscheidungsbedarf (Architecture Decision Records)](#20-entscheidungsbedarf-architecture-decision-records)
21. [Umsetzungs-Roadmap mit Phasen-Gates](#21-umsetzungs-roadmap-mit-phasen-gates)
22. [Projektorganisation und Governance](#22-projektorganisation-und-governance)
23. [Risikoregister](#23-risikoregister)
24. [Kennzahlen und Erfolgsmessung](#24-kennzahlen-und-erfolgsmessung)
25. [Anhang A – Anforderungs-Traceability Handover → Konzept](#25-anhang-a--anforderungs-traceability-handover--konzept)
26. [Anhang B – Repository-Sanierungsplan](#26-anhang-b--repository-sanierungsplan)
27. [Anhang C – Glossar](#27-anhang-c--glossar)

---

## 1. Management Summary

### 1.1 Worum es geht

PrescriptCheck ist eine Plattform, mit der **Ärztinnen und Ärzte Privatrezepte fälschungssicher ausstellen**, **Apotheken deren Echtheit und Status in Echtzeit prüfen und revisionssicher einlösen** und **Patientinnen und Patienten ihre Rezepte nachvollziehen** können. Kern des Produkts ist ein kryptografisch signierter, eindeutig nummerierter Rezeptnachweis (QR / PDF417) mit zentralem Statusregister und lückenlosem, manipulationsgeschütztem Audit-Trail.

### 1.2 Kernbefund der Bestandsaufnahme

Die historische Aussage, Grundfunktionen seien „implementiert oder vorbereitet", ist **durch das Repository nicht gedeckt**. Der Stand ist ein **Strukturgerüst**, kein lauffähiges Produkt:

| Bereich | Befund [GESICHERT] |
|---|---|
| `backend/` | 131 Dateien, davon **113 leer**; insgesamt ca. 170 Zeilen Code |
| `frontend/src/` | 107 Dateien, davon **102 leer**; ca. 136 Zeilen Code |
| `src/` (zweite Backend-Struktur) | 30 Dateien mit ca. 1.800 Zeilen; einziger substanzieller Code (Security-, Compliance-, Validator-Bausteine, Unit-Tests) |
| CI/CD | 22 Workflows, mehrere funktionale Dubletten |
| Deployment | parallel PM2, Docker Compose, Kubernetes, Helm, Terraform – ohne festgelegten Zielpfad |
| Dokumentation | `Abschlussbericht_PrescriptCheck.md` (v0.9.0) meldet sämtliche Ziele als „umgesetzt" – **das ist aus dem Code nicht ableitbar** |

Das ist kein Grund zur Sorge, sondern eine **Chance**: Weil kaum produktiver Code existiert, sind Architekturentscheidungen jetzt so günstig wie nie wieder.

### 1.3 Zentrale Empfehlungen

1. **Fokus statt Feature-Breite.** Der Anforderungskatalog (Mai 2025) umfasst rund 80 Einzelfunktionen von Rezeptvalidierung bis Videosprechstunde und Blockchain-Backup. Das ist keine Produktdefinition, sondern eine Ideensammlung. Das MVP wird **strikt auf den Kernnutzen „Ausstellen – Prüfen – Einlösen – Nachweisen"** reduziert.
2. **Signatur statt „Verschlüsselung mit Prüfsumme".** Der Rezeptcode trägt **keine Patientendaten**, sondern eine Rezept-ID mit **digitaler Signatur (Ed25519)**. Eine Prüfsumme allein ist fälschbar; eine Signatur nicht.
3. **Datenhaltung in Deutschland.** Gesundheitsdaten werden auf AT-Medical-kontrollierter Infrastruktur in Deutschland verarbeitet. MongoDB Atlas (US-Anbieter) und Cloudflare R2 sind für personenbezogene Daten **nicht** Zielbild.
4. **Starke Authentisierung über FIDO2/WebAuthn.** Die geplante „NFC-Security-ID-Card" wird als **FIDO2-Sicherheitsschlüssel mit NFC** umgesetzt – standardisiert, browserfähig, phishing-resistent – statt als proprietäres Kartensystem.
5. **Einige Ideen werden bewusst gestrichen oder zurückgestellt** (u. a. automatisierte Polizei-Alarmierung per TTS, Honeypot-Rezepte im Echtbetrieb, Blockchain-Backup, GPS-Tracking, uneingeschränkter „Gott-Modus"). Begründung in Kapitel 4.3.
6. **Repository-Sanierung vor Feature-Entwicklung** (Phase 0): eine Backend-Struktur, ein Frontend-Framework (React), ein Deployment-Pfad, konsolidierte Workflows, Prüfung der versionierten `.env.production`.
7. **Regulatorik früh klären:** DSFA (Art. 35 DSGVO), § 203 StGB-konforme Dienstleisterkette, MDR-Abgrenzung der KI-Funktionen, Positionierung gegenüber dem E-Rezept für Privatversicherte.

### 1.4 Zielbild in einem Satz

> PrescriptCheck ist der **vertrauenswürdige Echtheits- und Statusnachweis für Privatrezepte** – schlank im Kern, kompromisslos in Sicherheit und Nachweisbarkeit, erweiterbar über klar definierte Module und Schnittstellen.

---

## 2. Ausgangslage und Bestandsaufnahme

### 2.1 Quellenlage

| Quelle | Charakter | Verwendung in diesem Konzept |
|---|---|---|
| Handover (ChatGPT-Verlauf, Mai 2025) | Anforderungsliste, rekonstruiert aus „Langzeitkontext"; Aussagen zum Umsetzungsstand nicht belegt | Fachliche Anforderungsbasis [HISTORISCH] |
| Repository `DIG-prescriptcheck` | Tatsächlicher Dateibestand | Ist-Stand [GESICHERT] |
| `Abschlussbericht_PrescriptCheck.md` (16.03.2026, v0.9.0) | Statusbericht im Repo | Nur als Absichtserklärung; Umsetzungsangaben **nicht belastbar** |
| `ROADMAP.md`, `docs/ARCHITECTURE.md`, `README.md` | Teilweise widersprüchliche Projektbeschreibungen | Abgleich, Widersprüche in 2.3 |

### 2.2 Ist-Stand im Detail [GESICHERT]

**Substanzieller Code (Auswahl, `src/`):**

- `src/backend/app.js` – Express-Grundkonfiguration mit Helmet (CSP), CORS, Rate-Limiting
- `src/backend/security/encryption.js`, `hashing.js`, `tokenManagement.js` – Krypto-/Token-Bausteine
- `src/backend/compliance/auditTrail.js`, `dsgvo.js`, `gdpr.js`, `hipaa.js` – Compliance-Bausteine
- `src/shared/utils/qrCode.js`, `validators.js`, `formatters.js`; `src/shared/schemas/*.json`; `src/shared/types/*.ts`
- Unit-Tests: `src/backend/tests/unit/**`, `tests/compliance/*.test.js`

**Gerüst ohne Inhalt (leere Dateien):** sämtliche Models, Services, Controller, DTOs, Validatoren, Seeds und Docs-Dateien unter `backend/`; nahezu alle Komponenten, Pages, Hooks und Services unter `frontend/src/`; `docs/architecture/`, `docs/deployment/`, `docs/operations/`, `docs/governance/` (leer); `docs/specs/FHIR_Mapping_Details.md` (Platzhalter).

**Vorhandene Infrastruktur-Artefakte:** `docker/`, `docker-compose.yml`, `Dockerfile`, `deploy/kubernetes/*`, `deploy/helm/*`, `deploy/terraform/*`, `pm2.config.js`, `ecosystem.config.js`, `nginx_prescriptcheck.conf`, `setup_ssl_certbot.sh`, `prescriptcheck.service`, `monitoring/prometheus/*`.

**Governance-Artefakte:** `metadata/repository-profile.yml` (security-class: high), `CODEOWNERS`, `dependabot.yml`, Lizenzdateien (source-available, kommerziell).

### 2.3 Widersprüche und Mängel

| # | Befund | Bewertung | Maßnahme |
|---|---|---|---|
| B1 | `README.md` und Abschlussbericht nennen **Vue 3**; `frontend/package.json` und `App.js` nutzen **React 19**; `App.vue` enthält nur einen Kommentar; `docs/ARCHITECTURE.md` nennt React 18 | Framework-Entscheidung nicht dokumentiert konsistent | **React festschreiben** (Handover + Code), Vue-Reste entfernen, Doku korrigieren (ADR-02) |
| B2 | Zwei Backend-Strukturen: `backend/` (leer) und `src/backend/` (Code) | Doppelte Wahrheit, Testkonfiguration verweist auf beide | Eine Struktur festlegen (Anhang B) |
| B3 | `backend/routes/index.js` importiert `../middlewares/authMiddleware`, Verzeichnis heißt `middleware/` und Datei ist leer | Route nicht lauffähig | Wird mit Sanierung obsolet |
| B4 | `.env.production` ist **im Git versioniert** (enthält Schlüsselnamen für JWT, Stripe, PayPal, Klarna, SMTP) | Ob echte Werte enthalten sind, ist **aus dem Konzept heraus nicht bewertet** – Werte wurden bewusst nicht ausgelesen | **Sofort prüfen.** Sind echte Werte enthalten: Schlüssel rotieren, Datei aus dem Index entfernen, Historie bereinigen |
| B5 | `ARCHITECTURE.md` nennt Zielmärkte **Österreich und Deutschland** sowie HIPAA | HIPAA ist US-Recht und für den Zielmarkt irrelevant; Österreich ist im Handover nicht genannt | Zielmarkt Deutschland festlegen; HIPAA-Bezüge entfernen; Österreich als spätere Option (ADR-10) |
| B6 | Fünf parallele Deployment-Ansätze | Keiner davon ist als produktiv belegt | Einen Zielpfad festlegen (ADR-05) |
| B7 | 22 Workflows, u. a. `repo-self-check.yml` / `repository-selfcheck.yml`, `tag-validation.yml` / `tagging-validation.yml`, `governance.yml` / `governance-check.yml`, `deploy.yml` / `deploy-production.yml` | Wartungsaufwand, uneindeutige Pflicht-Checks | Konsolidierung auf ca. 8 Workflows (Kap. 18.4) |
| B8 | Abschlussbericht meldet u. a. Zahlungsabwicklung, Telemedizin, SCORM als „umgesetzt"; `scorm/module-*` enthält nur `.placeholder` | **Statusangabe sachlich falsch** | Bericht als „Planungsstand" kennzeichnen oder zurückziehen |
| B9 | `ROADMAP.md` enthält „GPS-Tracking für mobile Einlösungen" | Datenschutzrechtlich kaum begründbar | Streichen (Kap. 4.3) |
| B10 | Metadaten nennen Deploy-Ziel `r2` (Cloudflare) | Für Gesundheitsdaten ungeeignet (US-Anbieter) | R2 nur für öffentliche, nicht personenbezogene Assets |

### 2.4 Infrastruktur-Stand

Der Handover nennt einen Hetzner-Server (Ubuntu, Typ CX31) mit NGINX, PM2, Certbot und Cloud-Init. **Existenz, Typ, Standort, Härtung und Betriebszustand dieses Servers sind nicht belastbar dokumentiert und müssen live geprüft werden.** Hinweis: Hetzner hat seine Cloud-Servertypen zwischenzeitlich umbenannt; ob „CX31" noch existiert bzw. welcher Typ tatsächlich läuft, ist offen. Das Konzept trifft daher keine Annahmen über bestehende Server, IPs oder DNS-Einträge.

---

## 3. Problemstellung, Vision und Produktpositionierung

### 3.1 Problem

Privatrezepte werden in Deutschland überwiegend weiterhin auf Papier oder als PDF ausgestellt. Daraus ergeben sich strukturelle Schwächen:

- **Fälschbarkeit:** Formular, Praxisstempel und Unterschrift lassen sich mit geringem Aufwand nachahmen. Apotheken haben kaum Mittel, die Echtheit verlässlich zu prüfen.
- **Mehrfacheinlösung:** Kopien oder Scans können in mehreren Apotheken vorgelegt werden; es gibt kein zentrales Einlöseregister.
- **Fehlende Rückmeldung an die Praxis:** Ärztinnen und Ärzte erfahren nicht, ob, wann und wo ein Rezept eingelöst wurde, und können ein Rezept nach Ausstellung nicht wirksam sperren (z. B. bei Diebstahl des Rezeptblocks).
- **Aufwändige Rückfragen:** Zweifel an einem Rezept führen zu Telefonaten mit der Praxis – zeitintensiv und außerhalb der Sprechzeiten unmöglich.
- **Keine Nachweiskette:** Bei Verdachtsfällen fehlt eine belastbare, manipulationsgeschützte Dokumentation.

### 3.2 Vision

> **Jedes Privatrezept ist in Sekunden verifizierbar, genau einmal einlösbar und lückenlos nachweisbar – ohne dass dafür mehr personenbezogene Daten verarbeitet werden als nötig.**

### 3.3 Positionierung und Wettbewerbsumfeld

| Alternative | Stärke | Schwäche aus Sicht des Zielmarkts | PrescriptCheck-Abgrenzung |
|---|---|---|---|
| Papier-Privatrezept (Status quo) | Universell, keine Technik nötig | Fälschbar, kein Statusregister | Ergänzt Papier um verifizierbaren Code und Register |
| E-Rezept über die Telematikinfrastruktur (TI) | Gesetzlich verankert, Fälschungsschutz durch QES und Fachdienst | Für Privatversicherte nur, soweit Versicherer und Infrastruktur dies unterstützen; Selbstzahler, Ausländer, Sonderkonstellationen nicht durchgängig abgedeckt | Lösung für alle Konstellationen **außerhalb** der TI-Abdeckung; perspektivisch Brücke zur TI |
| Telefonische Rückfrage bei der Praxis | Persönlich | Langsam, nicht dokumentiert | Sofortige, dokumentierte Prüfung |

**Strategisches Risiko [OFFEN]:** Die Ausweitung des E-Rezepts auf Privatversicherte reduziert den adressierbaren Markt über die Zeit. Der aktuelle Umsetzungsstand des E-Rezepts für PKV-Versicherte ist vor Investitionsentscheidungen **marktseitig zu verifizieren**. Daraus folgt die Produktstrategie:

1. Fokus auf Segmente, die die TI absehbar nicht oder nicht vollständig abdeckt (Selbstzahler, Privatpraxen ohne TI-Anbindung, Ausland-Patienten, Sonderformulare).
2. Mehrwert jenseits der reinen Ausstellung: Praxis-Rückmeldung, Sperrfunktion, QS-Transparenz, Nachweisführung.
3. Architektur so auslegen, dass eine spätere TI-Anbindung als **Integration**, nicht als Neubau möglich ist (Kap. 15.5).

### 3.4 Nutzenversprechen je Zielgruppe

| Zielgruppe | Nutzen |
|---|---|
| Ärztinnen/Ärzte, Praxen | Fälschungsschutz, Sperrfunktion, Einlöse-Rückmeldung, weniger Rückfragen, Nachweis bei Missbrauch |
| Apotheken | Echtheitsprüfung in Sekunden, Schutz vor Mehrfacheinlösung, dokumentierte Sorgfalt bei der Rezeptprüfung, Entlastung bei Verdachtsfällen |
| Patientinnen/Patienten | Übersicht über eigene Rezepte, Vertrauensperson für Abholung, Schutz vor Missbrauch ihrer Identität |
| AT Medical | Skalierbares SaaS-Lizenzmodell, Datenplattform für QS (anonymisiert/aggregiert), Basis für weitere Module |

---

## 4. Scope und Abgrenzung

### 4.1 Grundsatz

Der Funktionsumfang wird nach **MoSCoW** und **Phasen** priorisiert. Jede Funktion muss einen der Kernnutzen (Echtheit, Einmaligkeit, Nachweis, Effizienz) messbar stärken oder ein regulatorisches Muss erfüllen. Alles andere ist Backlog.

### 4.2 Scope-Matrix

| Modul | Funktion | Priorität | Phase |
|---|---|---|---|
| **Rezept-Kern** | Ausstellung mit Seriennummer, Signatur, QR/PDF417, PDF-Druck | Must | 1 |
| | Status-Register (Lebenszyklus Kap. 6) | Must | 1 |
| | Sperrung durch ausstellende Ärztin/ausstellenden Arzt | Must | 1 |
| | Prüfung und Einlösung durch Apotheke inkl. Geburtsdatum-Abgleich | Must | 1 |
| | Einmal-Einlösetoken, Schutz gegen Doppeleinlösung | Must | 1 |
| | Listen, Filter, Mehrfachauswahl, Export (CSV/PDF) | Should | 1–2 |
| **Identität & Zugriff** | Organisation (Praxis/Apotheke), Nutzer, Rollen, Onboarding-Verifikation | Must | 1 |
| | MFA, FIDO2/WebAuthn, Gerätebindung | Must | 1 |
| | Sicherheitsstufen, Gegensignatur, zeitlich begrenzte Freigaben | Should | 2 |
| | Vertrauensperson für Abholung | Should | 3 |
| **Audit & Nachweis** | Manipulationsgeschützter Audit-Trail (Hash-Kette) | Must | 1 |
| | Externe Zeitstempel (RFC 3161), WORM-Archiv | Should | 2 |
| | Compliance-Reports, Prüfprotokolle, verschlüsselter Export | Should | 2 |
| | Behördenexport auf Rechtsgrundlage | Could | 3 |
| **QS & Sicherheit** | Regelbasierte Anomalieerkennung, QS-Score | Should | 2–3 |
| | Live-Monitor / Kontrollzentrum | Should | 3 |
| | ML-gestützte Verhaltensanalyse | Could | 4 |
| | Verdachtsmeldung durch Apotheke („Stiller Hinweis") | Should | 3 |
| **Lizenz & Abrechnung** | Tarife, Testlizenz, Stripe-Billing, Rechnungen, Mahnwesen | Must (vor Pilot-Ende) | 2 |
| | Partner-API Lizenzverwaltung | Could | 4 |
| **Schulung** | Pflichtschulung, jährliche Wiederholung, Nachweis (SCORM) | Should | 3 |
| **Patient** | Patientenansicht Rezeptverlauf | Should | 3 |
| **Integrationen** | Praxis-Widget (Rezeptanfrage) | Could | 3–4 |
| | Tiramizoo (Botendienst) | Could | 4 |
| | TI / E-Rezept-Brücke | Could | 4+ |
| | FHIR-Export | Could | 4 |
| **Formulare** | Sicherheitspapier mit Wasserzeichen/Hologramm, Bestellmodul | Could | 3–4 |
| **Plattform** | Mehrsprachigkeit (DE/EN zuerst), Dark Mode, Mobile | Should | 2–3 |
| | Benachrichtigungszentrale, Changelog, Release-Hinweise | Should | 2 |
| | Support-Chatbot | Won't (MVP) | Backlog |
| **Zusatzprodukte** | Videosprechstunde | Won't (eigenes Produkt) | Backlog |
| | Digitale Patientenakte | Won't (eigenes Produkt) | Backlog |

### 4.3 Bewusst gestrichene oder umgewidmete Anforderungen

Diese Punkte aus dem Handover werden in der ursprünglichen Form **nicht** umgesetzt. Das ist eine fachliche Entscheidung, keine Kosmetik.

| Ursprüngliche Anforderung | Problem | Entscheidung |
|---|---|---|
| **Silent Alert mit Polizei-Alarmierung per TTS** | Automatisierte Notrufe ohne menschliche Bewertung bergen hohes Fehlalarm-Risiko, Haftungsfragen und mögliche Konflikte mit Regeln zum Missbrauch von Notrufen; die Bedrohungslage in der Apotheke ist ein Personenschutz-, kein Softwarethema | **Umgewidmet** zu „Stiller Verdachtshinweis": diskrete Markierung im System, Sperre des Rezepts, Benachrichtigung der ausstellenden Praxis und des AT-Medical-QS-Teams. Keine automatische Behördenalarmierung. Persönliche Gefahr → Notruf 110 durch die Apotheke selbst |
| **Honeypots / Fake-Rezepte** | Fingierte Rezepte im Echtbetrieb täuschen reale Apotheken und verfälschen Statistiken; rechtlich und vertraglich heikel | **Nur** in einer gekennzeichneten Schulungs- und Testumgebung mit Einwilligung der Teilnehmenden |
| **Blockchain-Backup** | Kein Mehrwert gegenüber Hash-Kette + qualifizierten Zeitstempeln + WORM; Unveränderlichkeit kollidiert mit Löschpflichten (Art. 17 DSGVO) | **Ersetzt** durch Hash-verkettetes Audit-Log mit RFC-3161-Zeitstempeln und WORM-Archiv (Kap. 9.6) |
| **GPS-Tracking mobiler Einlösungen** (`ROADMAP.md`) | Keine erkennbare Erforderlichkeit; Bewegungsprofile von Apothekenpersonal sind unverhältnismäßig | **Gestrichen.** Standortplausibilität ausschließlich über die registrierte Betriebsstätte |
| **„Gott-Modus" für Administratoren** | Uneingeschränkter, nicht protokollierter Vollzugriff widerspricht Need-to-know, § 203 StGB-Schutz und jedem Audit | **Ersetzt** durch Break-Glass-Verfahren: Vier-Augen, zeitlich befristet, begründungspflichtig, vollprotokolliert (Kap. 8.5) |
| **Proprietäre NFC-Security-ID-Card** | Browser lesen NFC-Karten nur eingeschränkt; Eigenentwicklung von Kartenkryptografie ist riskant | **Umgesetzt als FIDO2-Sicherheitsschlüssel mit NFC/USB**; optional mit aufgedruckter Ausweisfunktion |
| **Verschlüsselter QR-Code „mit Prüfsumme"** | Prüfsumme schützt nicht vor Fälschung; Verschlüsselung im Code bedeutet Schlüsselverteilung an alle Prüfer | **Ersetzt** durch signierten Code ohne Patientendaten (Kap. 6.4) |
| **Videosprechstunde, Patientenakte** | Eigenständige Produktdomänen mit eigener Regulatorik | **Ausgegliedert**; ggf. Integration zertifizierter Drittanbieter |

---

## 5. Stakeholder, Akteure und Nutzungskontexte

### 5.1 Stakeholder-Übersicht

| Stakeholder | Interesse | Einfluss |
|---|---|---|
| AT Medical GmbH (Geschäftsführung, Projektleitung) | Wirtschaftlicher Erfolg, Reputation, Haftungsbegrenzung | Entscheidend |
| Ärztinnen/Ärzte, Praxispersonal | Einfache Ausstellung, Schutz vor Missbrauch | Hoch (Adoption) |
| Apotheken (Inhaber, Approbierte, PTA) | Schnelle, rechtssichere Prüfung | Hoch (Adoption) |
| Patientinnen/Patienten | Unkomplizierte Einlösung, Datenschutz | Mittel |
| Datenschutzbeauftragte/r AT Medical | DSGVO-Konformität | Hoch (Veto) |
| Kammern (Ärzte-, Apothekerkammern), Verbände | Berufsrechtliche Vereinbarkeit | Mittel (Akzeptanz) |
| Aufsichtsbehörden (Datenschutz, ggf. Arzneimittelaufsicht) | Rechtmäßigkeit | Hoch |
| Private Krankenversicherer, Beihilfestellen | Perspektivisch Fälschungsprävention | Mittel (Zukunft) |
| Integrationspartner (Tiramizoo, Praxissoftware-Hersteller) | Schnittstellen, Reichweite | Mittel |

### 5.2 Akteure im System

| Akteur | Beschreibung |
|---|---|
| **Verordnende Person** | Ärztin/Arzt (ggf. Zahnärztin/Zahnarzt) mit verifizierter Berufsberechtigung; stellt aus, sperrt |
| **Praxispersonal** | MFA o. ä.; bereitet Entwürfe vor, druckt, darf **nicht** final ausstellen |
| **Praxis-Administration** | Verwaltet Nutzer, Geräte, Lizenz der Praxis |
| **Apothekenpersonal** | Approbierte, PTA; prüft und löst ein |
| **Apotheken-Administration** | Verwaltet Nutzer, Geräte, Lizenz der Apotheke |
| **Patient/in** | Rezeptinhaber/in; optionaler Zugang zum Patientenportal |
| **Vertrauensperson** | Von der Patientin/dem Patienten benannte abholende Person |
| **AT-Medical-Betrieb** | Support, Onboarding-Verifikation, QS-Team, Plattformadministration |
| **Auditor/in** | Lesender, protokollierter Zugriff auf Audit- und Compliance-Daten |
| **Externe Systeme** | Zahlungsdienstleister, Mail-Versand, Zeitstempeldienst, Integrationspartner |

### 5.3 Nutzungskontexte

- **Praxis:** Desktop-Browser am Arbeitsplatz, Drucker, Sprechstundenstress → Ausstellung in < 60 Sekunden, Tastaturbedienung.
- **Apotheke:** HV-Tisch, Barcode-Scanner oder Kamera, Kundschaft wartet → Prüfergebnis in < 2 Sekunden, eindeutige Ampellogik.
- **Patient:** Smartphone, gelegentliche Nutzung → selbsterklärend, barrierearm.
- **Betrieb/QS:** Leitstand, Analyse, Fallbearbeitung → Übersicht, Filter, Vier-Augen-Workflows.

---

## 6. Fachkonzept: Rezeptlebenszyklus

### 6.1 Fachliche Mindestinhalte eines Privatrezepts

Die Pflichtangaben einer Verschreibung ergeben sich aus der Arzneimittelverschreibungsverordnung (AMVV, insbesondere § 2). Dazu zählen nach fachlichem Verständnis u. a. Name, Berufsbezeichnung und Anschrift der verschreibenden Person einschließlich Telefonnummer, Ausstellungsdatum, Name und Geburtsdatum der Patientin/des Patienten, Bezeichnung, Darreichungsform, Stärke und Menge des Arzneimittels, ggf. Gebrauchsanweisung sowie die eigenhändige Unterschrift bzw. bei elektronischer Verschreibung die qualifizierte elektronische Signatur.

> **[OFFEN – pharmazierechtliche Prüfung]** Vollständige und aktuelle Liste der Pflichtangaben, Gültigkeitsdauer von Privatrezepten, Zulässigkeit von Teileinlösungen sowie die Frage, ob ein PrescriptCheck-Rezept auf Papier mit eigenhändiger Unterschrift (Hybridmodell) oder als rein elektronisches Dokument mit QES ausgegeben wird. **Das Konzept geht im MVP vom Hybridmodell aus:** Papier mit Unterschrift bleibt das rechtlich maßgebliche Dokument; PrescriptCheck liefert den Echtheits- und Statusnachweis.

**Ausgeschlossen im MVP:** Betäubungsmittelrezepte (BtM-Rezept, eigenes amtliches Formular), T-Rezepte und sonstige Sonderformulare mit amtlicher Formularpflicht.

### 6.2 Zustandsmodell

Die Zustände aus dem Handover (gültig, eingelöst, abgelaufen, gesperrt, final, gedruckt) werden fachlich sauber getrennt in **Zustände** (exklusiv) und **Attribute** (zusätzlich):

```
            ┌──────────┐  ausstellen (Signatur)  ┌─────────────┐
  anlegen → │ ENTWURF  │ ───────────────────────▶│ AUSGESTELLT │──────┐
            └────┬─────┘                         └──┬───┬───┬──┘      │
                 │ verwerfen                        │   │   │         │ Gültigkeitsende
                 ▼                       einlösen   │   │   │ sperren ▼
            ┌──────────┐                            │   │   │   ┌────────────┐
            │ VERWORFEN│                            │   │   └──▶│ GESPERRT   │
            └──────────┘                            │   │       └─────┬──────┘
                                                    │   │             │ entsperren
                                                    │   │             │ (nur Ausstellerin/
                                                    │   │             │  Aussteller, begründet)
                                                    │   │             ▼
                                                    │   │        zurück nach AUSGESTELLT
                                                    ▼   ▼
                                           ┌────────────┐  ┌────────────┐
                                           │ EINGELÖST  │  │ ABGELAUFEN │
                                           └────────────┘  └────────────┘
```

| Zustand | Bedeutung | Handover-Begriff |
|---|---|---|
| `ENTWURF` | Angelegt, nicht signiert, nicht einlösbar, frei änderbar | – |
| `AUSGESTELLT` | Signiert, unveränderlich, einlösbar solange nicht abgelaufen | „final", „gültig" |
| `GESPERRT` | Durch Ausstellerin/Aussteller oder QS gesperrt; nicht einlösbar | „gesperrt" |
| `EINGELÖST` | Von einer Apotheke eingelöst; Endzustand | „eingelöst" |
| `ABGELAUFEN` | Gültigkeitsfrist überschritten; Endzustand | „abgelaufen" |
| `VERWORFEN` | Entwurf verworfen; Endzustand | – |

| Attribut | Bedeutung | Handover-Begriff |
|---|---|---|
| `printedAt`, `printCount` | Zeitpunkt und Anzahl der Ausdrucke; jeder Nachdruck wird protokolliert und auf dem Ausdruck kenntlich gemacht („Duplikat") | „gedruckt" |
| `blockReason` | Begründung der Sperre (Kategorien: Verlust, Diebstahl, Fehler, Verdacht, Sonstiges) | – |
| `qsFlags` | QS-Markierungen ohne Zustandsänderung | – |

> **„Gültig" ist kein gespeicherter Zustand**, sondern eine abgeleitete Aussage: `Zustand = AUSGESTELLT ∧ jetzt < Ablaufdatum`. Das vermeidet Inkonsistenzen.

**Teileinlösung [OFFEN]:** Wird pharmazierechtlich bestätigt, dass Teileinlösungen für Privatrezepte vorgesehen werden sollen, wird `EINGELÖST` um `TEILEINGELÖST` mit Positionsbezug erweitert. Im MVP: **Einlösung erfolgt vollständig.**

### 6.3 Übergangsregeln

| Übergang | Auslöser | Berechtigt | Bedingungen | Audit |
|---|---|---|---|---|
| ENTWURF → AUSGESTELLT | Ausstellen | Verordnende Person | Pflichtfelder vollständig; MFA-Session; Gerät registriert; Lizenz aktiv | Ja, inkl. Signatur-Hash |
| ENTWURF → VERWORFEN | Verwerfen | Ersteller/in, verordnende Person | – | Ja |
| AUSGESTELLT → EINGELÖST | Einlösen | Apothekenpersonal | Gültiges Einlösetoken; Geburtsdatum-Abgleich positiv; Apotheke verifiziert; atomare Prüfung | Ja |
| AUSGESTELLT → GESPERRT | Sperren | Verordnende Person; QS-Team (Vier-Augen) | Begründung Pflicht | Ja, Benachrichtigung |
| GESPERRT → AUSGESTELLT | Entsperren | Nur verordnende Person; bei QS-Sperre QS-Team mit Vier-Augen | Begründung Pflicht; nicht abgelaufen | Ja |
| AUSGESTELLT → ABGELAUFEN | Zeitablauf | System | Gültigkeitsende erreicht | Ja |
| EINGELÖST → (Storno) | Einlösestorno | Apotheke innerhalb kurzer Frist (z. B. 15 Minuten) **oder** QS-Team | Begründung; z. B. Fehlbedienung, Ware nicht abgegeben | Ja, Vier-Augen nach Fristablauf |

Alle Übergänge werden serverseitig über eine **zentrale Zustandsmaschine** ausgeführt. Kein Endpunkt setzt Zustandsfelder direkt.

### 6.4 Rezeptkennung und Rezeptcode

**Seriennummer [ZIELBILD]:**

```
PC-26-7KQ4-M9XT-R2
│  │  │         └─ Prüfzeichen (ISO 7064 MOD 37-36) – erkennt Tippfehler, kein Fälschungsschutz
│  │  └─ 8 Zeichen, zufällig (Crockford-Base32, ohne I/L/O/U) – nicht erratbar
│  └─ Jahr der Ausstellung
└─ Präfix
```

- Zufällig, nicht fortlaufend → keine Rückschlüsse auf Volumen einzelner Praxen, keine Aufzählbarkeit.
- Prüfzeichen dient nur der Eingabe-Plausibilisierung bei manueller Eingabe.

**Rezeptcode (QR und PDF417) [ZIELBILD]:**

Der Code enthält **keine Patientendaten im Klartext und nicht verschlüsselt**, sondern einen kompakten, signierten Datensatz:

| Feld | Inhalt |
|---|---|
| `v` | Formatversion |
| `id` | Seriennummer |
| `iss` | Pseudonyme Kennung der ausstellenden Praxis |
| `iat` | Ausstellungszeitpunkt |
| `exp` | Gültigkeitsende |
| `h` | Hash (SHA-256) über die kanonisierte Verordnung (Positionen, Mengen, Patientenbezug als Hash) |
| `kid` | Kennung des Signaturschlüssels |
| `sig` | Ed25519-Signatur über alle vorigen Felder |

Eigenschaften:

- **Fälschungssicher:** Ohne privaten Schlüssel der Plattform ist kein gültiger Code erzeugbar.
- **Offline verifizierbar (Echtheit):** Mit dem öffentlichen Schlüssel kann eine Apotheke die Echtheit auch bei Netzstörung prüfen. **Einlösung erfordert dennoch immer den Online-Statusabgleich** (sonst Doppeleinlösung möglich).
- **Inhaltsbindung:** Der Hash `h` bindet den Code an den gedruckten Inhalt. Weicht der vom System angezeigte Inhalt vom Papier ab, ist das Papier manipuliert.
- **Datensparsam:** Ein verlorenes Rezept verrät über den Code keine Gesundheitsdaten.
- **QR** für die Kamera-Prüfung, **PDF417** für die Kompatibilität mit vorhandenen Apotheken-Scannern.

**Schlüsselmanagement:** Signaturschlüssel liegen ausschließlich im Schlüsselspeicher (Kap. 9.4), werden regelmäßig rotiert (`kid`), alte öffentliche Schlüssel bleiben zur Verifikation veröffentlicht. Kompromittierte Schlüssel werden widerrufen; alle damit signierten offenen Rezepte werden markiert und den Praxen gemeldet.

### 6.5 Druckbild

Der Ausdruck enthält: alle Pflichtangaben, QR- und PDF417-Code, Seriennummer in Klarschrift, Prüf-URL, Hinweistext „Echtheit prüfbar unter …", Duplikat-Kennzeichnung bei Nachdruck, Unterschriftsfeld, optional Praxisstempel. In Phase 3/4 optional auf Sicherheitspapier (Kap. 7.9).

---

## 7. Fachkonzept: Kernprozesse

### 7.1 Onboarding und Berechtigungsprüfung (KYC)

**Grundsatz:** Rezepte stellt nur aus, wessen Berufsberechtigung geprüft ist. Rezepte löst nur ein, wer als Apotheke verifiziert ist.

| Schritt | Praxis | Apotheke |
|---|---|---|
| 1. Registrierung | Organisation, Ansprechperson, Rechnungsdaten | Organisation, Ansprechperson, Rechnungsdaten |
| 2. Nachweis | Approbationsurkunde bzw. Berufserlaubnis, ggf. Kammermitgliedschaft; Identitätsnachweis der Person | Betriebserlaubnis, verantwortliche/r Apothekenleiter/in, Identitätsnachweis |
| 3. Prüfung | Manuelle Prüfung durch AT-Medical-Onboarding nach Checkliste, Vier-Augen; Abgleich mit öffentlich verfügbaren Kammer- bzw. Arztverzeichnissen, soweit vorhanden | Manuelle Prüfung, Abgleich Apothekenverzeichnisse, soweit vorhanden |
| 4. Freischaltung | Je verordnende Person einzeln | Je Betriebsstätte |
| 5. Laufende Kontrolle | Jährliche Re-Verifikation; Ereignismeldungen (Approbationsruhen o. ä.) führen zur Sperre | Jährliche Re-Verifikation |

**Perspektive [OFFEN]:** Authentisierung mit elektronischem Heilberufsausweis (eHBA) bzw. SMC-B würde die manuelle Prüfung weitgehend ersetzen, setzt aber TI-Komponenten voraus (Kap. 15.5).

### 7.2 Rezeptausstellung

1. Verordnende Person meldet sich an (FIDO2 oder Passwort + TOTP) auf registriertem Gerät.
2. Patientendaten erfassen oder aus Praxis-Patientenliste übernehmen (Name, Geburtsdatum, optional Kontakt für Benachrichtigung).
3. Verordnungspositionen erfassen (Arzneimittel, Darreichungsform, Stärke, Menge, Dosierung). Arzneimittel-Stammdaten [OFFEN]: Lizenzierung einer Arzneimitteldatenbank klären; im MVP Freitext mit Pflichtstruktur.
4. Gültigkeitsdauer: Standard nach Rechtslage, verkürzbar.
5. Vorschau → **Ausstellen** (Signatur, Zustand `AUSGESTELLT`, Inhalt unveränderlich).
6. Drucken (PDF), optional digitale Übermittlung an Patient/in (nur mit Einwilligung; Link mit Ablauf, kein PDF-Anhang mit Gesundheitsdaten per E-Mail).
7. Korrektur nach Ausstellung = Sperren mit Grund „Fehler" + Neuausstellung (Verknüpfung „ersetzt durch").

Praxispersonal kann Schritte 2–4 als Entwurf vorbereiten; Schritt 5 ist der verordnenden Person vorbehalten.

### 7.3 Prüfung und Einlösung in der Apotheke

```
Scan QR/PDF417 ─▶ Signatur prüfen ─▶ Status online abfragen
                                          │
               ┌──────────────────────────┼─────────────────────────┐
               ▼                          ▼                         ▼
          ROT: ungültig             GELB: Hinweis              GRÜN: einlösbar
   (Signatur falsch, gesperrt,  (QS-Flag, Duplikat-Druck,   ─▶ Inhalt anzeigen
    eingelöst, abgelaufen)        kurz vor Ablauf)              (Positionen, Praxis)
                                                                     │
                                                    Geburtsdatum der vorlegenden Person
                                                    bzw. der Patientin/des Patienten eingeben
                                                                     │
                                                         Abgleich serverseitig (Hash)
                                                                     │
                                                    Einlösetoken (einmalig, 5 Min. TTL)
                                                                     │
                                                   „Abgabe bestätigen" ─▶ EINGELÖST
```

**Fachliche Regeln:**

- **Geburtsdatum-Abgleich:** Die Apotheke gibt das Geburtsdatum ein; das System antwortet nur „stimmt / stimmt nicht". Das gespeicherte Geburtsdatum wird **nie angezeigt** (keine Datenoffenlegung an Unberechtigte, die nur den Code besitzen). Nach drei Fehlversuchen: temporäre Sperre des Rezepts für Einlöseversuche, QS-Flag, Benachrichtigung der Praxis.
- **Einlösetoken:** Wird nach positivem Abgleich ausgegeben, ist an Rezept, Apotheke, Nutzer und Gerät gebunden, einmal verwendbar, kurzlebig. Verhindert Replay und Wettlaufsituationen.
- **Atomare Einlösung:** Die Zustandsänderung erfolgt als bedingte Aktualisierung (nur wenn Zustand noch `AUSGESTELLT`). Zwei Apotheken, die gleichzeitig einlösen, können nie beide erfolgreich sein.
- **Angezeigter Inhalt** muss mit dem Papier übereinstimmen; das System fordert die Bestätigung „Inhalt stimmt mit Vorlage überein".
- **Pharmazeutische Prüfpflicht bleibt unberührt.** PrescriptCheck unterstützt die Prüfung, ersetzt sie nicht. Das wird in der Oberfläche und in den AGB klar kommuniziert.

**Ausfallbetrieb:** Ist der Online-Abgleich nicht möglich, zeigt die App das Ergebnis der Offline-Signaturprüfung mit dem eindeutigen Hinweis „Echtheit bestätigt, **Status nicht prüfbar** – Einlösung nach eigenem Ermessen". Eine nachträgliche Einlösebuchung (mit Kennzeichnung „offline") ist möglich; Konflikte (bereits anderweitig eingelöst) werden dem QS-Team und beiden Apotheken gemeldet.

### 7.4 Sperrung

- Einzel- und Mehrfachsperre aus der Rezeptliste (Mehrfachauswahl).
- Sofortige Wirkung; gesperrte Rezepte erscheinen beim Scan rot mit Sperrkategorie, ohne Details zur Patientin/zum Patienten.
- „Notfallsperre": Sperre aller offenen Rezepte einer verordnenden Person (z. B. bei Verlust eines Rezeptblocks oder kompromittiertem Konto) mit einem Klick plus Bestätigung.

### 7.5 Vertrauensperson

- Patient/in benennt im Patientenportal oder in der Praxis eine abholberechtigte Person (Name, optional Geburtsdatum).
- Bei Einlösung wählt die Apotheke „Abholung durch Vertrauensperson" und gleicht deren Daten ab; protokolliert wird, wer abgeholt hat.
- Ohne Patientenportal: Abholung durch Dritte nach üblicher Apothekenpraxis; das System dokumentiert lediglich „Abholung durch Dritte".

### 7.6 Benachrichtigungen

| Ereignis | Empfänger | Kanal |
|---|---|---|
| Rezept eingelöst | Praxis (aggregiert/optional einzeln) | In-App, Tagesübersicht |
| Rezept gesperrt | Praxis; Patient/in (falls registriert) | In-App, E-Mail ohne Gesundheitsdaten |
| Einlöseversuch auf gesperrtes Rezept | Praxis, QS-Team | In-App, ggf. E-Mail |
| Geburtsdatum-Fehlversuche | Praxis, QS-Team | In-App |
| Ablauf in Kürze | Patient/in (falls registriert) | E-Mail/Push ohne Gesundheitsdaten |
| Lizenz, Rechnung, Zahlungsverzug | Organisations-Admin | E-Mail |

**Grundsatz:** E-Mails enthalten **keine Gesundheitsdaten**, sondern nur einen Hinweis und einen Link in die authentifizierte Anwendung.

### 7.7 Export und Berichte

- Praxis: eigene Rezepte (CSV, PDF), Einlösestatistik.
- Apotheke: eigene Einlösungen, Prüfprotokoll je Vorgang.
- Compliance: Zugriffs- und Ereignisberichte je Organisation, Schulungsnachweise.
- Exporte mit Gesundheitsdaten nur verschlüsselt (passwortgeschütztes Archiv mit AES-256; Passwort über separaten Kanal), alle Exporte im Audit-Trail; Massenexporte ab Schwelle mit Gegensignatur.

### 7.8 Verdachtsfälle und Behördenanfragen

**Verdachtsfall:**
1. Apotheke markiert „Verdacht" (stiller Hinweis, für die vorlegende Person nicht sichtbar) mit Kategorie und optionaler Notiz.
2. Rezept wird für weitere Einlösungen gesperrt (QS-Sperre).
3. Fall im QS-Leitstand; Benachrichtigung der ausstellenden Praxis.
4. Klärung durch QS-Team mit Praxis; Ergebnis dokumentiert (bestätigt / entkräftet).
5. Anzeige bei Behörden erstatten Praxis oder Apotheke selbst; AT Medical unterstützt mit Beweismitteldokumentation.

**Behördenanfragen:**
- Herausgabe nur auf Grundlage einer gültigen Rechtsgrundlage (z. B. Beschluss, Auskunftsersuchen mit Rechtsgrundlage), Prüfung durch Rechtsberatung, Vier-Augen-Freigabe.
- Export als strukturierter, signierter Datensatz (JSON) mit Hash-Nachweis aus dem Audit-Trail; verschlüsselt; Übergabeprotokoll.
- Keine proaktive Datenübermittlung an Behörden.

> **[OFFEN – anwaltliche Prüfung]** Verfahren für Behördenanfragen, Rolle von AT Medical als Auftragsverarbeiter vs. Verantwortlicher in diesem Kontext, berufsrechtliche Schweigepflichten.

### 7.9 Sicherheitsformulare (Phase 3/4)

- Bestellung von Rezeptformularen auf Sicherheitspapier (Wasserzeichen, ggf. Hologramm, vorgedruckte Praxisdaten/Stempel) über einen spezialisierten Druckpartner.
- Vorab vergebene Seriennummernkreise je Praxis; Formulare werden beim Ausstellen mit der Rezept-ID verknüpft; Verlust eines Formularbündels → Sammelsperre der Nummernkreise.
- Abrechnung über das Lizenzsystem (Rechnung).

### 7.10 Schulung

- Pflichtschulung vor erster Nutzung (Praxis: Ausstellung, Sperrung, Datenschutz; Apotheke: Prüfung, Verdachtsfälle, Datenschutz).
- Jährliche Wiederholung; ohne aktuellen Nachweis Hinweis, nach Karenzzeit Einschränkung auf Lesefunktionen (nicht auf Prüfung – die Apotheke muss Rezepte weiterhin prüfen können, Kap. 16.6).
- SCORM-Pakete (vorhandene Ordnerstruktur `scorm/`) bzw. integrierte Lernmodule; Nachweise revisionssicher gespeichert.

---

## 8. Rollen-, Rechte- und Freigabemodell

### 8.1 Grundprinzipien

- **Mandantenfähigkeit:** Jede Praxis und jede Apotheke ist eine Organisation (Mandant). Daten sind strikt mandantengetrennt; Zugriffe über Mandantengrenzen gibt es nur über definierte Prozesse (Prüfung, Einlösung).
- **Least Privilege und Need-to-know.**
- **Trennung von Plattform- und Organisationsrollen.**
- **Funktionstrennung:** Wer Daten freigibt, darf sie nicht allein exportieren; wer Rechte vergibt, darf sie sich nicht selbst vergeben.
- **RBAC mit Attributregeln (ABAC)** für Kontext: Organisation, Gerät, Sicherheitsstufe, Zeitfenster, Schulungsstatus, Lizenzstatus.

### 8.2 Rollenkatalog

**Organisationsrollen**

| Rolle | Organisation | Kernrechte |
|---|---|---|
| `PRACTICE_ADMIN` | Praxis | Nutzer, Geräte, Lizenz, Abrechnung der Praxis; keine Rezeptinhalte ohne Zusatzrolle |
| `PRESCRIBER` | Praxis | Rezepte ausstellen, sperren, entsperren, eigene/Praxis-Rezepte einsehen |
| `PRACTICE_STAFF` | Praxis | Entwürfe anlegen, drucken, Status einsehen |
| `PHARMACY_ADMIN` | Apotheke | Nutzer, Geräte, Lizenz, Abrechnung der Apotheke |
| `PHARMACIST` | Apotheke | Prüfen, einlösen, Storno innerhalb Frist, Verdacht melden |
| `PHARMACY_STAFF` | Apotheke | Prüfen, einlösen (konfigurierbar durch Apothekenleitung) |
| `PATIENT` | – | Eigene Rezepte, Vertrauenspersonen, Benachrichtigungen |
| `TRUSTEE` | – | Keine Systemanmeldung im MVP; nur als Datensatz |

**Plattformrollen (AT Medical)** – Zuordnung der Handover-Rollen:

| Rolle | Handover-Begriff | Kernrechte |
|---|---|---|
| `PLATFORM_ADMIN` | Administrator („Gott-Modus") | Technische Plattformverwaltung, **kein** Lesezugriff auf Gesundheitsdaten im Normalbetrieb; Break-Glass (8.5) |
| `OPERATOR` | Betreiber | Onboarding-Verifikation, Organisations- und Lizenzverwaltung, Support (Metadaten) |
| `MANAGER` | Manager | Geschäftsberichte, Tarife, aggregierte Kennzahlen |
| `SUPERVISOR` | Supervisor | QS-Leitstand, Fallbearbeitung, QS-Sperren (Vier-Augen) |
| `CONTROLLER` | Controller | Abrechnung, Mahnwesen, Finanzberichte |
| `AUDITOR` | Auditor | Lesend: Audit-Trail, Compliance-Berichte; jeder Zugriff selbst protokolliert |
| `USER` | User | Generische Basisrolle; im Zielbild durch die spezifischen Rollen oben ersetzt |

### 8.3 Sicherheitsstufen

Die Stufen 0–3 aus dem Handover werden als **Schutzklassen für Daten** definiert; Rollen erhalten Zugriff nur, wenn auch die Authentisierungsanforderung der Stufe erfüllt ist.

| Stufe | Daten | Beispiele | Mindestanforderung Zugriff |
|---|---|---|---|
| **0** | Systemkritische Konfiguration, Schlüssel, Break-Glass | Signaturschlüssel, Sicherheitsrichtlinien | FIDO2-Hardwareschlüssel + Vier-Augen + Begründung + Zeitfenster |
| **1** | Personenbezogene Gesundheitsdaten | Rezeptinhalte, Patientenname, Geburtsdatum | FIDO2 oder MFA, registriertes Gerät, aktive Schulung, Organisationsbezug |
| **2** | Betreiber- und Organisationsdaten | Organisationsstammdaten, Lizenz, Rechnungen, Nutzerlisten | MFA |
| **3** | Nutzerbezogene Basisdaten | eigenes Profil, Einstellungen | Passwort + MFA (Standard) |

### 8.4 Gegensignatur und zeitlich begrenzte Freigaben

- **Gegensignatur (Vier-Augen)** erforderlich für: Massenexport mit Stufe-1-Daten, QS-Sperre/-Entsperrung, Behördenexport, Break-Glass, Schlüsselrotation, Änderung von Sicherheitsrichtlinien, Rollenvergabe auf Plattformebene.
- **Just-in-Time-Freigaben:** Erhöhte Rechte werden beantragt, begründet, durch eine zweite berechtigte Person freigegeben und laufen automatisch ab (Standard 60 Minuten, maximal 8 Stunden).
- Jede Freigabe erzeugt einen Audit-Eintrag mit Antrag, Freigabe, Nutzung und Ablauf.

### 8.5 Break-Glass

Für echte Notfälle (z. B. Datenkorrektur nach schwerem Fehler, forensische Analyse) gibt es einen Notfallzugang:

1. Antrag mit Begründung und Ticketbezug,
2. Freigabe durch zweite Person aus festgelegtem Personenkreis,
3. zeitlich befristete, eng geschnittene Berechtigung,
4. Vollprotokollierung aller Aktionen, Sofortbenachrichtigung an Datenschutzbeauftragte/n und Geschäftsführung,
5. Nachbereitung innerhalb von 5 Werktagen.

### 8.6 Rechte-Matrix (Auszug)

| Aktion | PRESCRIBER | PRACTICE_STAFF | PHARMACIST | PATIENT | SUPERVISOR | AUDITOR | PLATFORM_ADMIN |
|---|---|---|---|---|---|---|---|
| Entwurf anlegen | ✔ | ✔ | – | – | – | – | – |
| Rezept ausstellen | ✔ | – | – | – | – | – | – |
| Rezept sperren | ✔ (eigene Praxis) | – | – | – | ✔ (4-Augen) | – | – |
| Rezept prüfen (Status) | ✔ (eigene) | ✔ (eigene) | ✔ (per Code) | ✔ (eigene) | ✔ | – | – |
| Rezept einlösen | – | – | ✔ | – | – | – | – |
| Inhalt einsehen | ✔ (eigene Praxis) | ✔ (eigene Praxis) | ✔ (nach Scan + Abgleich) | ✔ (eigene) | ✔ (Fallbezug) | – | Break-Glass |
| Audit-Trail einsehen | eigene Org. | – | eigene Org. | eigene Vorgänge | ✔ | ✔ | Break-Glass |
| Nutzer verwalten | – | – | – | – | – | – | ✔ (Plattform) |

---

## 9. Sicherheitskonzept

### 9.1 Schutzziele und Schutzbedarf

| Schutzziel | Schutzbedarf | Begründung |
|---|---|---|
| Vertraulichkeit | **sehr hoch** | Gesundheitsdaten (Art. 9 DSGVO), Berufsgeheimnis (§ 203 StGB) |
| Integrität | **sehr hoch** | Kernversprechen: Fälschungsschutz, Nachweisführung |
| Verfügbarkeit | **hoch** | Apothekenbetrieb; Ausfall verzögert Arzneimittelabgabe (Ausfallbetrieb vorhanden) |
| Nachweisbarkeit | **sehr hoch** | Revisionssicherheit, Beweisführung |

### 9.2 Bedrohungsmodell (STRIDE, Auszug)

| Bedrohung | Beispiel | Gegenmaßnahme |
|---|---|---|
| **S**poofing | Gefälschtes Arztkonto, gestohlene Zugangsdaten | KYC-Onboarding, FIDO2/MFA, Gerätebindung, Anomalieerkennung bei Anmeldung |
| **T**ampering | Manipuliertes Rezept, verändertes Audit-Log | Ed25519-Signatur, Inhalts-Hash, Hash-Kette, RFC-3161-Zeitstempel, WORM |
| **R**epudiation | „Ich habe das nicht eingelöst" | Nutzer-, Geräte- und Token-Bindung, Audit mit Zeitstempel |
| **I**nformation Disclosure | Datenabfluss, Code-Scan durch Unbefugte | Kein Patientenbezug im Code, Feldverschlüsselung, Mandantentrennung, Abgleich statt Anzeige |
| **D**enial of Service | Überlastung der Prüf-API | Rate-Limiting, WAF-Regeln, Skalierung, Ausfallbetrieb offline |
| **E**levation of Privilege | Rechteausweitung, IDOR | Zentrale Autorisierung, Objektprüfung je Request, Pentests, Vier-Augen für Plattformrechte |
| Insider | Missbrauch durch AT-Medical-Personal | Kein Standardzugriff auf Gesundheitsdaten, Break-Glass, Auditor-Rolle, Verpflichtung nach § 203 StGB |
| Lieferkette | Kompromittierte npm-Abhängigkeit | Lockfiles, Dependabot, SCA, SBOM, minimale Abhängigkeiten, signierte Builds |

Das vollständige Bedrohungsmodell wird in Phase 0 als eigenes Dokument erstellt und bei jeder Architekturänderung fortgeschrieben.

### 9.3 Authentisierung und Gerätebindung

- **FIDO2/WebAuthn** als primärer Faktor für Stufe 0/1 (Plattform-Authenticator oder Hardwareschlüssel mit NFC/USB = „Security ID Card" des Handovers).
- **TOTP** als Fallback, **kein SMS-OTP** für privilegierte Rollen.
- **Gerätebindung:** Registrierung eines Geräts durch Organisations-Admin; Bindung über WebAuthn-Credential bzw. Geräte-Zertifikat statt Browser-Fingerprinting (zuverlässiger, datensparsamer). Geräteübersicht mit letzter Nutzung, Sperre, Entzug.
- **Sitzungen:** kurzlebige Access-Tokens (≤ 15 Min.), rotierende Refresh-Tokens (httpOnly, Secure, SameSite=strict), Inaktivitäts-Timeout am HV-Tisch konfigurierbar, Re-Authentisierung vor Stufe-0/1-Aktionen.
- **Passwörter:** Mindestlänge 12, Prüfung gegen bekannte kompromittierte Passwörter, Argon2id (Bestand: bcrypt – akzeptabel, Migration bei nächstem Login).
- **Sicherheitskarten-Verwaltung:** Ausgabe, Zuordnung, Verlustmeldung, Sperre, Ersatz – mit Nachweis.

### 9.4 Kryptografie und Schlüsselmanagement

| Zweck | Verfahren |
|---|---|
| Transport | TLS 1.3 (TLS 1.2 nur mit starken Suiten), HSTS mit Preload |
| Rezeptsignatur | Ed25519, Schlüssel im Schlüsselspeicher, Rotation mindestens jährlich |
| Feldverschlüsselung | AES-256-GCM, Envelope Encryption: Data Encryption Key je Mandant, verschlüsselt mit Key Encryption Key |
| Geburtsdatum-Abgleich | HMAC-SHA-256 mit geheimem Pepper + verschlüsselte Klartextkopie für berechtigte Anzeige |
| Audit-Integrität | SHA-256-Hash-Kette, HMAC je Eintrag, periodische RFC-3161-Zeitstempel |
| Passwörter | Argon2id |
| Exporte | AES-256 (verschlüsseltes Archiv), Passwortübermittlung getrennt |

**Schlüsselspeicher [ZIELBILD]:** Selbst betriebener Secrets-/Key-Management-Dienst (HashiCorp Vault oder OpenBao) in Deutschland; mittelfristig HSM-gestützt. Der bestehende Ansatz mit Schlüsseln in Umgebungsvariablen ist **nur für Entwicklung** zulässig.

### 9.5 Anwendungssicherheit

- Ausrichtung an **OWASP ASVS Level 2**, für Rezept-, Einlöse- und Audit-Komponenten Level 3.
- Zentrale Eingabevalidierung (Schema-basiert), Ausgabe-Encoding, strikte CSP (Bestand in `src/backend/app.js` als Ausgangspunkt), CSRF-Schutz, Schutz vor NoSQL-Injection (Operator-Filter).
- Autorisierung an **einer** Stelle (Policy-Layer), nicht verteilt in Controllern.
- Sicherheitsrelevante Header, keine Fehlerdetails an Clients, strukturierte Fehlercodes.
- SAST (CodeQL), SCA (Dependabot/npm audit), Secret Scanning, DAST gegen Staging.
- Externer Penetrationstest vor Pilotstart und danach jährlich sowie nach größeren Änderungen.

### 9.6 Audit-Trail

**Inhalt je Eintrag:** Zeitpunkt (UTC, Server), Akteur (Nutzer-ID, Rolle, Organisation), Gerät, IP-Adresse (gekürzt nach Ablauf der Sicherheitsfrist, Kap. 11.5), Aktion, Objekt, Ergebnis, Begründung (falls Pflicht), Korrelations-ID, Hash des vorherigen Eintrags, HMAC.

**Eigenschaften:**
- Append-only; keine Update-/Delete-Rechte für die Anwendung.
- Hash-Kette je Mandant; stündliche Verankerung über RFC-3161-Zeitstempel eines vertrauenswürdigen Dienstes.
- Tägliche Übertragung in ein WORM-Archiv (Object Lock) in Deutschland. **[OFFEN]** Verfügbarkeit von Object Lock beim gewählten Anbieter prüfen.
- Verifikationswerkzeug, das die Integrität für einen Zeitraum nachweist (für Audits und Beweisführung).
- Zugriff auf den Audit-Trail wird seinerseits protokolliert.

### 9.7 Infrastruktursicherheit

- Netzsegmentierung: öffentliche Zone (Reverse Proxy), Anwendungszone, Datenzone ohne öffentliche Erreichbarkeit.
- Administration nur über VPN/Bastion mit FIDO2; kein Passwort-SSH, kein Root-Login.
- Härtung nach CIS-Benchmark bzw. BSI-Grundschutz-Bausteinen; automatische Sicherheitsupdates; Host-Firewall.
- Container: minimale Images, Non-Root, Read-only-Filesystem wo möglich, Image-Scanning, signierte Images.
- Zentrales Logging und Alarmierung (Kap. 17).

### 9.8 Organisatorische Sicherheit

- Informationssicherheits-Leitlinie, Rollen (ISB), Richtlinien (Zugang, Kryptografie, Lieferanten, Incident).
- Verpflichtung aller Mitarbeitenden und Dienstleister auf Vertraulichkeit und § 203 StGB.
- Schulungen (Security Awareness, Datenschutz) jährlich.
- Bestehende Dokumente `security/incident-response.md`, `security/security-policies.md`, `SECURITY.md` werden in dieses Rahmenwerk überführt.
- Zielbild: ISMS nach **ISO/IEC 27001** (Zertifizierung als Option ab Phase 4); Prüfung, ob für Kundengruppen ein **BSI C5**-Testat erforderlich wird (Kap. 12).

---

## 10. Qualitätssicherung, Anomalieerkennung und Missbrauchsabwehr

### 10.1 Grundsatz

**Regeln vor Machine Learning, Mensch vor Automatik.** Automatische Maßnahmen sind auf klar begründete, reversible Schutzreaktionen begrenzt (z. B. temporäre Sperre eines Rezepts nach Fehlversuchen). Maßnahmen gegen Personen oder Organisationen (Kontosperre) erfordern menschliche Bewertung – außer bei eindeutiger Kompromittierung.

### 10.2 Regelbasierte Erkennung (Phase 2–3)

| Signal | Beispiel | Reaktion |
|---|---|---|
| Mehrfachscan | Rezept wird in kurzer Zeit in mehreren Apotheken gescannt | QS-Flag, Hinweis an Praxis |
| Einlöseversuch auf gesperrtes/eingelöstes Rezept | – | Rot-Anzeige, QS-Ereignis |
| Geburtsdatum-Fehlversuche | ≥ 3 | Temporäre Einlösesperre, QS-Flag |
| Ausstellungsvolumen ungewöhnlich | Stark über dem individuellen Normalwert | QS-Prüfung |
| Ausstellung außerhalb üblicher Zeiten / neues Gerät / neue Region | – | Re-Authentisierung, QS-Hinweis |
| Auffällige Wirkstoffmuster | Häufung missbrauchsrelevanter Wirkstoffe | QS-Prüfung (Liste fachlich zu definieren) |
| Signaturfehler | Gefälschter Code gescannt | Sicherheitsereignis, Fallanlage |

### 10.3 QS-Score

- Je Organisation ein transparenter Index (z. B. Anteil validierter Einlösungen, Reaktionszeit auf Hinweise, Schulungsstatus, bestätigte Verdachtsfälle).
- **Transparenzpflicht:** Organisationen sehen ihren eigenen Score und dessen Zusammensetzung.
- **Keine automatische Sanktion** allein auf Basis des Scores; der Score steuert Prüfintensität und Support.
- Reputations-Tracking nur aggregiert und ohne öffentliche Rankings.

### 10.4 Live-Monitor / Kontrollzentrum

- Echtzeitübersicht über Validierungsquoten, Sicherheitsereignisse, offene Fälle, Systemzustand.
- Fallmanagement mit Zuständigkeit, Status, Fristen, Vier-Augen-Abschluss.
- Zugriff nur für `SUPERVISOR`, Inhalte pseudonymisiert bis Fallbezug hergestellt ist.

### 10.5 KI-Prüfassistenz (Phase 4)

- Einsatz erst nach ausreichender Datenbasis und Validierung.
- Ausschließlich **Missbrauchs- und Betrugserkennung**, **keine** pharmakologischen oder therapeutischen Empfehlungen (Interaktionen, Dosierungen) – sonst droht eine Einstufung als Medizinprodukt (Kap. 12.3).
- Transparenz und menschliche Letztentscheidung; Dokumentation nach den Anforderungen der KI-Verordnung (Kap. 12.4).
- Modelltraining nur auf pseudonymisierten Daten mit Rechtsgrundlage und DSFA-Abdeckung.

### 10.6 Schulungs- und Testumgebung

- Eigene Umgebung mit synthetischen Daten für Schulung, Demo, Integrationstests.
- Dort sind auch Test-/Übungsrezepte („Honeypot"-Szenarien) zulässig – klar gekennzeichnet, nie im Produktivsystem.

---

## 11. Datenschutzkonzept

### 11.1 Rollenverteilung nach DSGVO [OFFEN – datenschutzrechtliche Prüfung]

| Verarbeitung | Wahrscheinliche Rolle AT Medical | Konsequenz |
|---|---|---|
| Rezeptdaten der Praxen | Auftragsverarbeiter (Art. 28) der Praxis | AVV mit jeder Praxis; Weisungsgebundenheit |
| Einlösedaten der Apotheken | Auftragsverarbeiter der Apotheke bzw. gemeinsame Verantwortung (Art. 26) – klärungsbedürftig | Modell vertraglich festlegen |
| Plattformübergreifende QS, Missbrauchserkennung | Eigener Verantwortlicher (berechtigtes Interesse / Vertrag) oder gemeinsame Verantwortung | Rechtsgrundlage und Zweckbindung präzise festlegen |
| Lizenz, Abrechnung, Nutzerkonten | Verantwortlicher | Eigene Datenschutzerklärung |
| Patientenportal | Verantwortlicher bzw. gemeinsame Verantwortung mit Praxis | Einwilligung / Vertrag |

Die Rollenverteilung ist **die** zentrale datenschutzrechtliche Architekturfrage und muss vor dem Pilotbetrieb anwaltlich bestätigt werden.

### 11.2 Rechtsgrundlagen (fachliche Einordnung)

- Gesundheitsdaten: Art. 9 Abs. 2 lit. h DSGVO i. V. m. § 22 BDSG (Verarbeitung durch bzw. unter Verantwortung von Berufsgeheimnisträgern), ergänzend Behandlungsvertrag.
- Patientenportal, digitale Rezeptzustellung, Benachrichtigungen an Patient/innen: Einwilligung (Art. 9 Abs. 2 lit. a).
- Sicherheitsprotokollierung: Art. 6 Abs. 1 lit. c/f, Art. 32 DSGVO.

### 11.3 Datenschutz-Folgenabschätzung

- **Pflicht** (Art. 35 DSGVO): umfangreiche Verarbeitung von Gesundheitsdaten, neue Technologie, systematische Überwachung (Anomalieerkennung).
- Erstellung in Phase 0/1, Abschluss vor Pilotstart, Fortschreibung bei jeder wesentlichen Änderung.
- Der Abschlussbericht erwähnt eine „DSFA-konforme Risikobewertung" – **ein entsprechendes Dokument ist im Repository nicht vorhanden** und muss beigebracht oder neu erstellt werden.

### 11.4 Privacy by Design und by Default

| Prinzip | Umsetzung |
|---|---|
| Datenminimierung | Kein Patientenbezug im Code; Geburtsdatum-Abgleich statt Anzeige; Patientenkontakt nur optional |
| Zweckbindung | Getrennte Datenbereiche für Rezeptbetrieb, QS, Abrechnung |
| Pseudonymisierung | QS-Auswertungen pseudonymisiert; Statistik aggregiert |
| Verschlüsselung | Feldverschlüsselung für Stufe-1-Daten, mandantenspezifische Schlüssel |
| Speicherbegrenzung | Löschkonzept (11.5) mit automatisierter Durchsetzung |
| Transparenz | Patient/innen können Zugriffe auf eigene Rezepte einsehen (Portal) |
| Betroffenenrechte | Prozesse für Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit; Unterstützung der Verantwortlichen |

### 11.5 Lösch- und Aufbewahrungskonzept [OFFEN – Fristen rechtlich bestätigen]

| Datenkategorie | Aufbewahrung (Vorschlag) | Grundlage / Hinweis |
|---|---|---|
| Rezeptdatensätze | Bis zur Klärung der einschlägigen ärztlichen und pharmazeutischen Aufbewahrungspflichten; Vorschlag: konfigurierbar je Organisation, Standard nach Rechtsprüfung | Berufsrechtliche Dokumentationspflichten, ApBetrO – zu prüfen |
| Audit-Trail | Entsprechend Rezeptdaten, mindestens so lange wie die zugehörigen Rezepte | Nachweisfunktion |
| Vollständige IP-Adressen | 30 Tage, danach gekürzt | Sicherheitszweck |
| Anmeldeprotokolle | 12 Monate | Sicherheitszweck |
| Abrechnungsdaten | Nach handels- und steuerrechtlichen Fristen (HGB/AO) | Gesetzlich |
| Schulungsnachweise | Dauer der Nutzung + Nachweisfrist | Nachweispflicht |
| Testlizenz ohne Konversion | 90 Tage nach Ablauf | Datenminimierung |

Löschung in WORM-Archiven erfolgt durch **Crypto-Shredding** (Vernichtung des mandanten- bzw. zeitraumbezogenen Schlüssels) – so bleiben Integritätsnachweise der Hash-Kette erhalten, Inhalte werden unlesbar.

### 11.6 Auftragsverarbeiter und Drittlandtransfer

**Grundsatz:** Verarbeitung personenbezogener Gesundheitsdaten ausschließlich in der EU, bevorzugt in Deutschland, bei Anbietern ohne Zugriffsrisiko aus Drittstaaten-Recht.

| Dienst | Zielbild | Bewertung |
|---|---|---|
| Hosting/Compute | Deutscher Anbieter, Rechenzentrum in Deutschland | Zielbild |
| Datenbank | Selbst betrieben auf o. g. Infrastruktur | Zielbild |
| MongoDB Atlas | – | **Nicht Zielbild** für Stufe-1-Daten (US-Konzern; Drittlandsrisiko, auch bei EU-Region) |
| Cloudflare R2 / CDN | Nur öffentliche statische Assets | **Keine** personenbezogenen Daten |
| E-Mail-Versand | EU-Anbieter oder eigener MTA; Inhalte ohne Gesundheitsdaten | Zielbild |
| Zahlungsdienstleister | Stripe (nur Abrechnungsdaten der Organisationen, keine Gesundheitsdaten) | Vertretbar mit AVV/SCC |
| Zeitstempeldienst | Vertrauensdiensteanbieter in der EU | Zielbild |

Für alle Dienstleister: AVV, Verpflichtung nach § 203 Abs. 3/4 StGB, Prüfung TOMs, Eintrag im Verzeichnis der Verarbeitungstätigkeiten.

---

## 12. Regulatorische Einordnung und Compliance

> Alle Einordnungen in diesem Kapitel sind **fachliche Vorbewertungen**. Verbindliche Aussagen erfordern anwaltliche bzw. regulatorische Prüfung. Zertifizierungen oder Konformitätsbewertungen liegen **nicht** vor.

### 12.1 Übersicht

| Regelwerk | Relevanz | Bewertung / Maßnahme |
|---|---|---|
| DSGVO / BDSG | Hoch | Kapitel 11; DSFA, AVV, VVT, TOMs |
| § 203 StGB | Hoch | Dienstleisterkette verpflichten; kein Standardzugriff von AT Medical auf Inhalte |
| AMVV, ApBetrO, AMG | Hoch | Fachliche Pflichtangaben, Prüfpflichten der Apotheke unberührt; Gestaltung des Hybridmodells prüfen |
| Berufsordnungen (Ärzte, Apotheker) | Mittel | Vereinbarkeit (z. B. Zuweisungsverbote, freie Apothekenwahl) – Rezeptzuweisung an bestimmte Apotheken darf das System **nicht** steuern |
| MDR (EU 2017/745) | Mittel | 12.3 |
| KI-Verordnung (EU 2024/1689) | Niedrig–Mittel | 12.4 |
| NIS2 / NIS2-Umsetzung in Deutschland | Prüfen | Abhängig von Unternehmensgröße und Sektorzuordnung; Prüfpunkt, nicht vorausgesetzt |
| SGB V / Telematikinfrastruktur | Perspektivisch | Erst bei TI-Anbindung (Kap. 15.5); Cloud-Anforderungen (u. a. C5-Testate) für Leistungserbringer prüfen |
| eIDAS / Vertrauensdienstegesetz | Mittel | Bei rein elektronischer Verschreibung mit QES; Zeitstempel |
| BITV 2.0 / Barrierefreiheitsstärkungsgesetz | Mittel | Barrierefreiheit (WCAG 2.1 AA) als Ziel; Anwendbarkeit des BFSG auf B2B-SaaS prüfen |
| GoBD, Umsatzsteuerrecht, E-Rechnung | Hoch (Abrechnung) | Kap. 16.5 |
| TTDSG/TDDDG | Mittel | Cookie-/Endgerätezugriff: nur technisch notwendige Speicherung |
| LkSG | Niedrig | Anwendungsbereich nach Unternehmensgröße voraussichtlich nicht eröffnet; freiwilliges Beschwerdeverfahren (Handover) optional |
| HIPAA | **Nicht relevant** | US-Recht; aus Code und Doku entfernen |

### 12.2 Haftungs- und Kommunikationsgrundsätze

- PrescriptCheck **bestätigt Echtheit und Status** eines im System ausgestellten Rezepts – nicht die medizinische oder pharmazeutische Richtigkeit.
- Prüf- und Validierungsseiten enthalten klare Hinweise (Handover-Anforderung) zum Umfang der Prüfung.
- AGB, Nutzungsbedingungen und SLAs regeln Verfügbarkeit, Ausfallbetrieb und Haftungsbegrenzung – **anwaltlich zu erstellen**.

### 12.3 Medizinprodukte-Abgrenzung (MDR)

- Die Kernfunktion (Ausstellung, Echtheitsprüfung, Statusverwaltung, Dokumentation) dient nach fachlicher Einschätzung **keinem medizinischen Zweck** im Sinne von Art. 2 MDR und ist daher voraussichtlich **kein Medizinprodukt**.
- **Risiko:** Funktionen wie Interaktionsprüfung, Dosierungswarnungen oder KI-gestützte pharmakologische Empfehlungen können eine Einstufung als Medizinprodukt auslösen.
- **Entscheidung:** Solche Funktionen sind **nicht Bestandteil** dieses Konzepts. Eine formale Zweckbestimmung („Intended Purpose") wird in Phase 0 dokumentiert und regulatorisch bestätigt.
- **DiGA** ist für PrescriptCheck **nicht einschlägig** (DiGA sind patientenseitige Medizinprodukte mit medizinischem Zweck zur Erstattung durch die GKV). Der entsprechende Punkt im Abschlussbericht („Zertifizierung nach MDR/DiGA prüfen") wird durch die MDR-Abgrenzung ersetzt.

### 12.4 KI-Verordnung

- Regelbasierte Erkennung fällt nicht unter KI-Systeme im engeren Sinn; ML-basierte Anomalieerkennung voraussichtlich kein Hochrisiko-KI-System, ist aber vor Einführung einzuordnen.
- Pflichten zu Transparenz, menschlicher Aufsicht und Dokumentation werden unabhängig von der Einstufung umgesetzt; KI-Kompetenz der Mitarbeitenden (Schulung) wird sichergestellt.

### 12.5 Compliance-Artefakte (Soll)

| Artefakt | Phase |
|---|---|
| Zweckbestimmung / MDR-Abgrenzung | 0 |
| Verzeichnis der Verarbeitungstätigkeiten | 0–1 |
| DSFA | 1 (Abschluss vor Pilot) |
| TOMs nach Art. 32 | 1 |
| AVV-Muster (Praxis, Apotheke), Unterauftragsverarbeiter-Liste | 1 |
| Datenschutzerklärungen (Plattform, Portal) | 1 |
| Lösch- und Aufbewahrungskonzept | 1 |
| Informationssicherheits-Leitlinie, Richtlinien, Notfallhandbuch | 1–2 |
| Pentest-Bericht | vor Pilot |
| AGB, Nutzungsbedingungen, SLA | 2 |
| Schulungskonzept und Nachweise | 3 |
| ISMS / ISO-27001-Vorbereitung | 4 |

---

## 13. Technische Zielarchitektur

### 13.1 Architekturprinzipien

1. **Modularer Monolith zuerst.** Ein deploybares Backend mit klar getrennten Modulen (Domain-Grenzen), keine Microservices im MVP. Spätere Herauslösung einzelner Module (z. B. Prüf-API) möglich.
2. **Eine Wahrheit je Thema:** eine Backend-Struktur, ein Frontend, ein Deployment-Pfad, eine Konfigurationsquelle.
3. **Security by Default:** Autorisierung, Validierung, Audit sind Querschnitt im Framework, nicht Aufgabe einzelner Endpunkte.
4. **API-first:** Frontend, Apotheken-Scanner-App, Widget und Partner nutzen dieselbe versionierte API.
5. **Infrastructure as Code** und reproduzierbare Builds.
6. **Beobachtbarkeit** von Beginn an (Logs, Metriken, Traces, Audit getrennt).
7. **TypeScript** für neuen Code (Bestand `src/shared/types/*.ts` als Ansatz).

### 13.2 Systemkontext

```
   Praxis-Browser         Apotheken-Browser / Scanner        Patient (Smartphone)
          │                          │                               │
          └──────────────┬───────────┴───────────────┬───────────────┘
                         │ HTTPS                      │
                 ┌───────▼────────┐          ┌────────▼───────┐
                 │ Reverse Proxy  │          │ Öffentliche     │
                 │ NGINX (TLS,    │          │ Prüfseite /     │
                 │ Rate-Limit)    │          │ Public-Key-     │
                 └───────┬────────┘          │ Endpunkt        │
                         │                   └────────┬───────┘
                 ┌───────▼─────────────────────────────▼──────┐
                 │           PrescriptCheck Backend            │
                 │  (Node.js / TypeScript, modularer Monolith) │
                 └──┬──────────┬───────────┬──────────┬───────┘
                    │          │           │          │
             ┌──────▼───┐ ┌────▼────┐ ┌────▼────┐ ┌───▼────────┐
             │ MongoDB  │ │ Redis   │ │ Vault / │ │ Objektspei-│
             │ Replica  │ │ (Queue, │ │ OpenBao │ │ cher (PDF, │
             │ Set      │ │ Cache,  │ │ (Keys)  │ │ WORM-Audit)│
             └──────────┘ │ Limits) │ └─────────┘ └────────────┘
                          └─────────┘
   Externe Dienste: Stripe · E-Mail (EU) · RFC-3161-Zeitstempel · später TI, Tiramizoo
```

### 13.3 Technologie-Stack [ZIELBILD]

| Schicht | Technologie | Begründung / Bezug zum Bestand |
|---|---|---|
| Frontend | React 19, TypeScript, Vite, React Router | Bestand `frontend/package.json`; Handover nennt React |
| UI-Bibliothek | Eine barrierearme Komponentenbibliothek (Entscheidung Phase 0) | Konsistenz, WCAG |
| i18n | i18next | Bestand: JSON-Sprachdateien DE/EN/FR/IT/NL/PL |
| Backend | Node.js (LTS), Express 5, TypeScript | Bestand `backend/package.json` (Express 5) |
| Validierung | Schema-basiert (z. B. Zod oder JSON Schema) | Bestand `src/shared/schemas/*.json` |
| Datenbank | MongoDB (selbst betriebenes Replica Set, Transaktionen) | Bestandsentscheidung Handover, Hosting geändert (ADR-03) |
| Queue/Cache/Rate-Limit | Redis | Asynchrone Jobs (PDF, Mails, Ablauf), verteiltes Rate-Limiting |
| Schlüsselverwaltung | HashiCorp Vault oder OpenBao | Kap. 9.4 |
| PDF/Barcode | Serverseitige PDF-Erzeugung, QR + PDF417 | Bestand `qrCode.js` |
| Reverse Proxy | NGINX | Bestand `nginx_prescriptcheck.conf` |
| Laufzeit | Docker Compose auf dedizierten Hosts (MVP/Pilot) | Konsolidierung (ADR-05) |
| Monitoring | Prometheus, Grafana, Alertmanager, Loki | Bestand `monitoring/` |
| CI/CD | GitHub Actions | Bestand, konsolidiert |

### 13.4 Backend-Modulschnitt

| Modul | Verantwortung |
|---|---|
| `identity` | Organisationen, Nutzer, Rollen, Sessions, MFA/WebAuthn, Geräte, Onboarding |
| `authorization` | Policy-Engine (RBAC + Attributregeln), Sicherheitsstufen, JIT-Freigaben, Vier-Augen |
| `prescription` | Entwürfe, Ausstellung, Zustandsmaschine, Sperren, Druck, Seriennummern |
| `verification` | Code-Prüfung, Statusabfrage, Geburtsdatum-Abgleich, Einlösetoken, Einlösung, Storno |
| `signing` | Signaturdienst, Schlüsselrotation, Public-Key-Veröffentlichung |
| `audit` | Append-only-Log, Hash-Kette, Zeitstempel, Archiv, Verifikation |
| `qs` | Regeln, Scores, Fälle, Leitstand |
| `notification` | In-App, E-Mail, Vorlagen, Präferenzen |
| `licensing` | Tarife, Lizenzen, Feature-Flags, Testphase |
| `billing` | Stripe-Integration, Rechnungen, Mahnwesen, Webhooks |
| `training` | Schulungen, Nachweise, Fälligkeiten |
| `patient` | Portal, Vertrauenspersonen, Einwilligungen |
| `reporting` | Berichte, Exporte |
| `integration` | Partner-API, Webhooks, Widget, spätere TI/Tiramizoo-Adapter |
| `platform` | Konfiguration, Feature-Flags, Health, Changelog |

Module kommunizieren über definierte Service-Schnittstellen und Domain-Events (intern), nicht über direkte Datenbankzugriffe auf fremde Collections.

### 13.5 Frontend-Architektur

- Eine SPA mit rollenbasierten Bereichen (Praxis, Apotheke, Patient, Plattform); Code-Splitting je Bereich.
- Eigene, schlanke **Apotheken-Prüfansicht** (Kiosk-Modus) für den HV-Tisch: Scan → Ampel → Abgleich → Bestätigen.
- Zustandsverwaltung serverorientiert (Query-Cache), keine Gesundheitsdaten in `localStorage`.
- Barcode-Erfassung über Tastatur-Wedge-Scanner und Kamera (Web-API).
- PWA-Fähigkeit für Patientenportal (Phase 3).

### 13.6 Umgebungen

| Umgebung | Zweck | Daten |
|---|---|---|
| `local` | Entwicklung | Synthetisch |
| `ci` | Automatisierte Tests | Synthetisch, flüchtig |
| `staging` | Abnahme, DAST, Pentest | Synthetisch |
| `training` | Schulung, Demo, Übungsszenarien | Synthetisch, gekennzeichnet |
| `production` | Pilot- und Echtbetrieb | Echt |

Produktionsdaten werden **niemals** in andere Umgebungen kopiert.

---

## 14. Datenmodell

### 14.1 Kernentitäten

| Entität | Wesentliche Felder | Schutzstufe |
|---|---|---|
| `Organization` | id, typ (PRAXIS/APOTHEKE), name, anschrift, verifikationsstatus, lizenzId, erstelltAm | 2 |
| `User` | id, organisationId, rollen[], name, e-mail, berufsnachweis (Ref.), mfa, status | 2/3 |
| `Device` | id, organisationId, bezeichnung, credentialId, registriertVon, letzteNutzung, status | 2 |
| `SecurityKey` | id, userId, typ (FIDO2), seriennummer (optional), status, ausgegebenAm | 0/2 |
| `Patient` (praxisbezogen) | id, organisationId, name (verschl.), geburtsdatum (verschl. + HMAC), kontakt (optional, verschl.) | 1 |
| `Prescription` | id (Seriennummer), organisationId, prescriberId, patientRef, zustand, ausgestelltAm, gueltigBis, inhaltHash, signatur, kid, printCount, blockReason, ersetztDurch, version | 1 |
| `PrescriptionItem` | rezeptId, arzneimittel, darreichungsform, staerke, menge, dosierung (verschl.) | 1 |
| `VerificationEvent` | id, rezeptId, apothekeId, userId, deviceId, ergebnis, zeit | 1/2 |
| `RedemptionToken` | token (Hash), rezeptId, apothekeId, userId, deviceId, ablauf, verwendet | 1 |
| `Redemption` | rezeptId, apothekeId, userId, zeit, abholer (Patient/Vertrauensperson/Dritte), offline, storniert | 1 |
| `Trustee` | patientRef, name (verschl.), geburtsdatum (HMAC), gueltigBis | 1 |
| `AuditEvent` | seq, mandant, zeit, akteur, geraet, ip, aktion, objekt, ergebnis, begruendung, prevHash, hmac | 1 |
| `QsCase` | id, typ, objekte[], status, zustaendig, entscheidung, vierAugen | 1 |
| `License` / `Subscription` | organisationId, tarif, laufzeit, status, stripeIds, testBis | 2 |
| `Invoice` | nummer, organisationId, betraege, status, pdfRef, eRechnungRef | 2 |
| `TrainingRecord` | userId, modul, abgeschlossenAm, faelligAm, nachweisHash | 2 |
| `Consent` | patientRef, zweck, erteiltAm, widerrufenAm | 1 |
| `Notification` | empfaenger, typ, referenz, gelesen | 2/3 |

### 14.2 Modellierungsregeln

- Optimistic Locking (`version`) für alle zustandsbehafteten Entitäten; Zustandsübergänge als bedingte Updates bzw. Transaktionen.
- Mandanten-ID in jeder mandantenbezogenen Collection; Abfragen ohne Mandantenfilter werden auf Framework-Ebene verhindert.
- Verschlüsselte Felder werden nicht indiziert; Suche nach Patienten über Blind-Index (HMAC) innerhalb des Mandanten.
- Schemaversionierung mit Migrationen; die bestehenden JSON-Schemas (`src/shared/schemas`) werden als Ausgangspunkt übernommen und angeglichen.
- FHIR-Kompatibilität: Feldbezeichnungen und Strukturen orientieren sich an `MedicationRequest` und den deutschen E-Rezept-Profilen, um spätere Exporte/Integrationen zu erleichtern (Platzhalter `docs/specs/FHIR_Mapping_Details.md` wird befüllt).

---

## 15. API- und Integrationskonzept

### 15.1 API-Grundsätze

- REST/JSON, versioniert (`/api/v1`), dokumentiert mit **OpenAPI 3.1** (generiert und im Repo versioniert; ersetzt die leeren `backend/docs/*Doc.js`).
- Einheitliches Fehlerformat (RFC 9457 Problem Details), Korrelations-IDs, Idempotenzschlüssel für schreibende Operationen.
- Paginierung, Filter, Sortierung standardisiert.
- Rate-Limits je Endpunktklasse und Mandant.

### 15.2 Zentrale Endpunkte (Auszug)

| Methode | Pfad | Zweck | Rolle |
|---|---|---|---|
| POST | `/api/v1/prescriptions` | Entwurf anlegen | PRESCRIBER, PRACTICE_STAFF |
| POST | `/api/v1/prescriptions/{id}/issue` | Ausstellen (Signatur) | PRESCRIBER |
| POST | `/api/v1/prescriptions/{id}/block` | Sperren | PRESCRIBER, SUPERVISOR |
| POST | `/api/v1/prescriptions/block-bulk` | Mehrfachsperre | PRESCRIBER |
| GET | `/api/v1/prescriptions/{id}/pdf` | Druck-PDF | PRESCRIBER, PRACTICE_STAFF |
| POST | `/api/v1/verifications` | Code prüfen (Status) | PHARMACIST, PHARMACY_STAFF |
| POST | `/api/v1/verifications/{id}/identity-check` | Geburtsdatum-Abgleich → Token | PHARMACIST, PHARMACY_STAFF |
| POST | `/api/v1/redemptions` | Einlösung mit Token | PHARMACIST, PHARMACY_STAFF |
| POST | `/api/v1/redemptions/{id}/cancel` | Storno | PHARMACIST |
| POST | `/api/v1/qs/reports` | Verdachtshinweis | PHARMACIST |
| GET | `/api/v1/audit` | Audit-Abfrage | AUDITOR, Org.-Admins (eigene) |
| GET | `/.well-known/prescriptcheck/keys` | Öffentliche Signaturschlüssel | öffentlich |
| GET | `/check/{serial}` | Öffentliche Prüfseite (nur „echt/nicht echt", kein Inhalt) | öffentlich, stark limitiert |

### 15.3 Praxis-Widget (Phase 3–4)

- Einbettbares Formular für Praxis-Websites zur **Rezeptanfrage** (z. B. Folgerezept), **keine** Ausstellung.
- Anfrage landet als Aufgabe in der Praxis; Entscheidung und Ausstellung erfolgen regulär in PrescriptCheck.
- Schutz: Bot-Abwehr, Rate-Limits, Einwilligungstext, Datenminimierung, keine Gesundheitsdaten im Browser-Speicher.
- Berufsrechtliche Prüfung zu Fernbehandlung/Folgeverordnung **[OFFEN]**.

### 15.4 Tiramizoo / Botendienste (Phase 4)

- Apotheke beauftragt nach Einlösung optional die Auslieferung über einen Lieferpartner.
- Übermittelt werden ausschließlich Lieferdaten (Adresse, Zeitfenster, Paketreferenz) – **keine** Rezeptinhalte.
- Statusrückmeldung über Webhooks; Vertrag/AVV mit Lieferpartner; Schnittstellenspezifikation des Partners **live zu prüfen**.

### 15.5 Telematikinfrastruktur (Phase 4+)

- Optionen: (a) Authentisierung mit eHBA/SMC-B, (b) Brücke zum E-Rezept-Fachdienst, (c) Nutzung von TI-Diensten für sichere Kommunikation.
- Voraussetzung: Zulassungs- und Spezifikationslage der gematik, ggf. zugelassene Komponenten oder Partner.
- **Entscheidung:** Keine TI-Entwicklung vor Product-Market-Fit; Architektur hält Adapter-Schnittstelle (`integration`-Modul) bereit.

### 15.6 Partner-API

- Mandantenfähige API-Clients mit OAuth 2.0 Client Credentials, Scopes, mTLS optional.
- Anwendungsfälle: Lizenzverwaltung für Kooperationspartner, Praxissoftware-Integration (Ausstellung aus dem PVS), Apothekensoftware-Integration (Prüfung aus der Warenwirtschaft).
- Partnervertrag, Sandbox, Zertifizierungsprozess für Integrationen.

---

## 16. Lizenz-, Zahlungs- und Geschäftsmodell

### 16.1 Erlösmodell

SaaS-Lizenzen je Organisation (Praxis/Apotheke), Laufzeit monatlich oder jährlich, Nettopreise zzgl. gesetzlicher Umsatzsteuer. **Konkrete Preise sind im Handover nicht festgelegt und werden in diesem Konzept nicht erfunden.**

### 16.2 Tarifstruktur (Vorschlag)

| Merkmal | Basic | Pro | Expert |
|---|---|---|---|
| Rezeptausstellung / Prüfung | ✔ | ✔ | ✔ |
| Sperrfunktion, Audit, Basisberichte | ✔ | ✔ | ✔ |
| Nutzer / Geräte | begrenzt | erweitert | unbegrenzt |
| Exporte, Compliance-Berichte | – | ✔ | ✔ |
| QS-Score, erweiterte Benachrichtigungen | – | ✔ | ✔ |
| Patientenportal, Vertrauensperson | – | ✔ | ✔ |
| Praxis-Widget, API-Zugang | – | – | ✔ |
| Sicherheitsformulare (Bestellung) | Zukauf | Zukauf | Zukauf |
| Support | Standard | Priorisiert | Priorisiert + Ansprechperson |

**Apotheken-Strategie [OFFEN – Geschäftsentscheidung]:** Der Netzwerkeffekt hängt an der Apothekendichte. Empfehlung: Prüffunktion für Apotheken **kostenfrei oder sehr niedrigschwellig**, Monetarisierung primär über Praxen und Mehrwertfunktionen. Ohne flächendeckende Apothekenteilnahme hat das Produkt für Praxen keinen Nutzen.

### 16.3 Testlizenz

- Zeitlich begrenzt (z. B. 30 Tage), voller Funktionsumfang des Ziel-Tarifs, Countdown in der Oberfläche, Erinnerungen vor Ablauf.
- Nach Ablauf ohne Konversion: Ausstellung gesperrt; bereits ausgestellte Rezepte bleiben prüf- und einlösbar bis zu ihrem Ablauf.

### 16.4 Zahlungsabwicklung

- **Ein Zahlungsdienstleister im MVP: Stripe Billing** (Abonnements, SEPA-Lastschrift, Karte, Rechnungen). Klarna und PayPal werden – soweit im Stripe-Konto für Deutschland verfügbar – als Stripe-Zahlungsmethoden angebunden statt als separate Integrationen. **Verfügbarkeit im konkreten Stripe-Konto prüfen.**
- Kauf auf Rechnung (Überweisung) für Formularbestellungen und Jahreslizenzen.
- Webhooks mit Signaturprüfung, idempotente Verarbeitung, Abgleich-Job.
- Upgrades/Downgrades mit anteiliger Verrechnung.

### 16.5 Rechnungsstellung

- GoBD-konforme, fortlaufende Rechnungsnummern, unveränderbare Archivierung.
- E-Rechnung im B2B-Bereich (XRechnung/ZUGFeRD) – Umsetzungspflichten und Übergangsfristen **steuerlich prüfen**; Architektur von Beginn an E-Rechnungs-fähig.
- Automatischer Versand über das zentrale Mailsystem (Handover), Rechnungsarchiv im Organisationsbereich.

### 16.6 Zahlungsverzug und Sperrlogik

| Stufe | Zeitpunkt (Vorschlag) | Wirkung |
|---|---|---|
| Erinnerung | Fälligkeit + 3 Tage | Hinweis in App und per E-Mail |
| 1. Mahnung | + 14 Tage | Hinweisbanner |
| 2. Mahnung | + 28 Tage | Ankündigung der Einschränkung |
| Einschränkung | + 35 Tage | **Keine neuen Ausstellungen**; Sperren, Prüfen, Einlösen, Exporte eigener Daten bleiben möglich |
| Kündigung | nach Vertrag | Datenrückgabe/-löschung nach AVV |

> **Patientenschutz-Grundsatz:** Zahlungsverzug einer Organisation darf **niemals** dazu führen, dass bereits ausgestellte Rezepte nicht mehr geprüft oder eingelöst werden können oder Praxen Rezepte nicht mehr sperren können.

### 16.7 Wirtschaftliche Planung [OFFEN]

Für Investitionsentscheidungen sind zu erstellen: Marktmodell (Anzahl Privatpraxen/Privatrezepte, Apotheken), Preisvalidierung (Interviews im Pilot), Kostenmodell (Infrastruktur, Personal, Pentests, Recht, Support), Break-even-Analyse. Diese Zahlen liegen nicht vor und werden hier nicht geschätzt.

---

## 17. Betrieb, Infrastruktur und Notfallkonzept

### 17.1 Zielinfrastruktur (Pilot)

| Komponente | Zielbild |
|---|---|
| Standort | Rechenzentrum in Deutschland (Bestandsrichtung: Hetzner – **Ist-Zustand live prüfen**) |
| Hosts | Getrennte Hosts für Anwendung und Datenbank; Datenbank als Replica Set (3 Knoten) |
| Netzwerk | Privates Netz zwischen Hosts, öffentlich nur Reverse Proxy (443) |
| Laufzeit | Docker Compose, gesteuert über CI/CD; PM2 entfällt im Container-Betrieb |
| TLS | Let's Encrypt via Certbot oder ACME im Proxy (Bestand `setup_ssl_certbot.sh`) |
| Backups | Verschlüsselt, zweiter Standort in Deutschland, unveränderlich |
| Admin-Zugang | VPN/Bastion, FIDO2 |

Die in der übrigen AT-Medical-Infrastruktur bestehenden Server, Netze und Dienste werden **nicht** vorausgesetzt; eine Einbindung (z. B. in vorhandenes Monitoring oder Mesh/VPN) erfolgt nur nach Abgleich mit dem gesicherten Infrastrukturstand.

### 17.2 Betriebsziele (Vorschlag)

| Kennzahl | Ziel Pilot | Ziel Regelbetrieb |
|---|---|---|
| Verfügbarkeit Prüf-/Einlöse-API | 99,5 % | 99,9 % |
| Verfügbarkeit übrige Funktionen | 99,0 % | 99,5 % |
| Antwortzeit Prüfung (p95) | < 800 ms | < 500 ms |
| RPO (max. Datenverlust) | 15 Minuten | 5 Minuten |
| RTO (max. Wiederherstellungszeit) | 8 Stunden | 4 Stunden |

### 17.3 Monitoring und Alarmierung

- Metriken (Prometheus, Bestand `monitoring/prometheus`), Dashboards (Grafana), Logs (Loki), Alarmierung (Alertmanager, Bestand `monitoring/alerting/alerts.yml`).
- Fachliche Metriken: Ausstellungen/Prüfungen/Einlösungen pro Minute, Fehlerraten, Signaturfehler, Geburtsdatum-Fehlversuche.
- Synthetische Prüfungen (Test-Rezept in Produktion **nicht** – stattdessen Health-Endpunkte und Staging-Probes).
- Logs ohne Gesundheitsdaten (strukturierte Felder, Redaction).

### 17.4 Backup und Wiederherstellung

- 3-2-1-Prinzip: tägliche Vollsicherung, kontinuierliche Oplog-Sicherung (Point-in-Time-Recovery), verschlüsselt, zweiter Standort, mindestens eine unveränderliche Kopie.
- **Monatlicher Restore-Test** mit Protokoll; Backup ohne getesteten Restore gilt als nicht vorhanden.
- Schlüssel-Backups getrennt von Daten-Backups, Wiederherstellung nur im Vier-Augen-Prinzip.
- Bestehendes `backup/backup-schedule.md` wird in diesen Rahmen überführt.

### 17.5 Incident- und Notfallmanagement

- Schweregrade (SEV1–SEV4), Bereitschaftsregelung, Eskalationspfade.
- Datenschutzverletzungen: Bewertung und ggf. Meldung an die Aufsichtsbehörde innerhalb von 72 Stunden (Art. 33 DSGVO) bzw. Unterstützung der Verantwortlichen; Benachrichtigung Betroffener (Art. 34).
- Sicherheitsvorfälle: ggf. Meldung an CERT/BSI je nach Anwendbarkeit (NIS2-Prüfung).
- Notfallhandbuch inkl. Szenarien: Schlüsselkompromittierung, Datenbankausfall, Rechenzentrumsausfall, Ransomware, kompromittiertes Arztkonto, Massenfälschung.
- Post-Mortems ohne Schuldzuweisung, Maßnahmenverfolgung.
- Kommunikation an Kunden über Statusseite und vorbereitete Textbausteine.

### 17.6 Support

- Kanäle: Ticketsystem, E-Mail (Bestand: support@at-medical.de laut Abschlussbericht – live prüfen), Telefon zu Kernzeiten für Apotheken.
- Supportpersonal sieht **keine** Rezeptinhalte; Fehleranalyse über Korrelations-IDs und Metadaten.
- Wissensdatenbank / Wiki (Kap. 19.4).

---

## 18. Qualitäts-, Test- und Release-Konzept

### 18.1 Teststrategie

| Ebene | Inhalt | Ziel |
|---|---|---|
| Unit | Domänenlogik, Zustandsmaschine, Krypto-Wrapper, Validatoren | ≥ 90 % Branch-Coverage für `prescription`, `verification`, `signing`, `audit`, `authorization`; ≥ 80 % gesamt |
| Integration | API + Datenbank (Testcontainer), Webhooks, Mails | Alle Endpunkte, alle Zustandsübergänge |
| Contract | OpenAPI-Konformität, Partner-API | Keine Breaking Changes ohne Versionssprung |
| E2E | Kernabläufe Praxis/Apotheke im Browser (Playwright) | Ausstellen → Prüfen → Einlösen → Audit grün |
| Security | SAST, SCA, Secrets, DAST, Autorisierungsmatrix-Tests (jede Rolle × jede Aktion) | Keine offenen High/Critical |
| Last | Prüf-API unter Spitzenlast (Vorgabe Kap. 17.2) | p95 eingehalten |
| Nebenläufigkeit | Gleichzeitige Einlösung desselben Rezepts | Genau eine Einlösung erfolgreich |
| Restore | Monatlich | Dokumentierter Erfolg |
| Usability | Tests mit Praxis- und Apothekenpersonal | Ausstellung < 60 s, Prüfung < 10 s |
| Barrierefreiheit | Automatisiert + manuell | WCAG 2.1 AA |

Die vorhandenen Tests (`src/backend/tests/unit/**`, `tests/compliance/*`) werden übernommen; HIPAA-Tests entfallen.

### 18.2 Definition of Done

- Code reviewed (mindestens 1 Review, für Sicherheitsmodule 2 inkl. Security-Owner gemäß `CODEOWNERS`)
- Tests grün, Coverage-Ziele eingehalten
- OpenAPI aktualisiert, Changelog-Eintrag
- Audit-Ereignisse für neue Aktionen definiert
- Berechtigungen in der Rechte-Matrix ergänzt und getestet
- Datenschutz-Check (neue Daten? → VVT/DSFA prüfen)
- Keine neuen High/Critical-Befunde

### 18.3 Branching und Release

- Trunk-based mit kurzlebigen Feature-Branches, geschützter `main`, Pflicht-Checks.
- Semantische Versionierung; Releases über Tags (Bestand `release.yml`).
- Deployment: `main` → Staging automatisch; Produktion nach Freigabe (manuelles Gate, Vier-Augen).
- Datenbankmigrationen vorwärtskompatibel; Rollback-Pfad dokumentiert (Bestand `deploy/scripts/rollback.sh`).
- SBOM je Release, signierte Container-Images.
- Kundenkommunikation über In-App-Changelog und Release-Notes.

### 18.4 Workflow-Konsolidierung (Ziel)

| Ziel-Workflow | Ersetzt / bündelt |
|---|---|
| `ci.yml` | `ci.yml`, `ci-validation.yml`, `test.yml` |
| `security.yml` | `security-scan.yml`, `dependency-scan.yml`, `dependency-check.yml`, `audit.yml` |
| `governance.yml` | `governance.yml`, `governance-check.yml`, `repo-self-check.yml`, `repository-selfcheck.yml`, `file-tagging.yml` |
| `compliance.yml` | `compliance-check.yml` |
| `release.yml` | `release.yml`, `tag-validation.yml`, `tagging-validation.yml` |
| `docker.yml` | `docker.yml` |
| `deploy.yml` | `deploy.yml`, `deploy-staging.yml`, `deploy-production.yml` (Umgebungen als Parameter) |
| `maintenance.yml` | `safe-cleanup.yml`, `cleanup-weekly.yml` |

Vor dem Entfernen wird je Workflow geprüft, ob er als Pflicht-Check in den Branch-Schutzregeln hinterlegt ist; die Konsolidierung erfolgt in einem eigenen, separat reviewten Pull Request.

---

## 19. UI/UX-, Kommunikations- und Dokumentationskonzept

### 19.1 Gestaltungsgrundsätze

- **Klarheit vor Fülle:** Status immer eindeutig (Farbe + Symbol + Text, nie Farbe allein).
- **Prozessorientierte Oberflächen:** Die Apotheke sieht einen Prüfablauf, keine Datenbankmaske.
- **Erklärung am Ort:** Info-Symbol („i") mit Tooltip an erklärungsbedürftigen Stellen (Handover).
- **Konsistentes AT-Medical-Branding:** Logo mit grünem Haken (Bestand `assets/logo.PNG`), einheitlicher Footer: „© {Jahr} | AT Medical GmbH | Alle Rechte vorbehalten | AGB | Datenschutz | Kontakt | Support | Dokumentation".
- Hell/Dunkel-Modus, responsiv, mobile Patientenansicht, Tastaturbedienbarkeit, WCAG 2.1 AA.
- Schnellzugriffsleiste, Favoriten, Aufgabenliste, Live-Countdown (Ablauf, Testlizenz) – Phase 2–3.

### 19.2 Zentrale Ansichten

| Bereich | Ansichten |
|---|---|
| Praxis | Dashboard (offene/eingelöste/gesperrte Rezepte), Rezept anlegen, Rezeptliste mit Filter/Mehrfachauswahl, Rezeptdetail mit Verlauf, Patienten, Benachrichtigungen, Organisation (Nutzer, Geräte, Lizenz) |
| Apotheke | Prüfansicht (Kiosk), Einlöseverlauf, Verdachtshinweise, Organisation |
| Patient | Meine Rezepte, Vertrauenspersonen, Zugriffsprotokoll, Einstellungen |
| Plattform | Onboarding-Queue, QS-Leitstand, Fälle, Lizenzen, Audit, Systemzustand |

Die im Repository angelegten, aber leeren Seiten (Dashboard, Prescriptions, Validation, AuditLog, Monitoring, Reports, Users, Settings, Login) und Komponenten (PrescriptionCard, QRCodeModal, StatusBadge, AlertButton, AuditLogTable u. a.) bilden einen brauchbaren Strukturansatz und werden auf diese Ansichten abgebildet.

### 19.3 Mehrsprachigkeit

- Phase 2: Deutsch (führend), Englisch.
- Weitere Sprachen (Bestand FR, IT, NL, PL) nach Bedarf; fachliche Begriffe mit Glossar, Rechtstexte nur nach juristischer Freigabe übersetzen.
- Ausgedruckte Rezepte in Deutsch.

### 19.4 Dokumentation

| Dokument | Zielgruppe | Ort |
|---|---|---|
| Dieses Gesamtkonzept | Management, Projekt | `docs/konzept/` |
| ADRs | Entwicklung, Architektur | `docs/adr/` |
| Architektur (C4-Diagramme), Bedrohungsmodell | Entwicklung, Security | `docs/architecture/` |
| OpenAPI-Spezifikation | Entwicklung, Partner | `docs/api/` |
| Betriebshandbuch, Runbooks, Notfallhandbuch | Betrieb | `docs/operations/` |
| Compliance-Dokumentation (VVT, DSFA, TOMs) | DSB, Auditoren | Separates, zugriffsbeschränktes Ablagesystem; im Repo nur Verweise |
| Benutzerhandbücher (Praxis, Apotheke, Patient) | Anwender | Wiki / Hilfe-Center |
| Admin-Handbuch | AT-Medical-Betrieb | Wiki |
| FAQ, How-tos, Changelog | Alle | Wiki / In-App |

Die vorhandenen PDFs (`docs/manuals/*.pdf`, `docs/tech-architecture.pdf`) werden inhaltlich geprüft und gegen den Zielstand aktualisiert oder als historisch gekennzeichnet.

### 19.5 System-E-Mails

- Einheitliches HTML-Template (Branding, Footer, Rechtshinweise), Textversion, keine Gesundheitsdaten, keine Tracking-Pixel.
- Versand über authentifizierte Domain (SPF, DKIM, DMARC) – **Mail-Infrastruktur von AT Medical live prüfen, keine Annahmen**.

---

## 20. Entscheidungsbedarf (Architecture Decision Records)

| ADR | Thema | Empfehlung | Status | Entscheider |
|---|---|---|---|---|
| ADR-01 | Produktfokus MVP | Kern „Ausstellen – Prüfen – Einlösen – Nachweisen"; Streichliste Kap. 4.3 | Vorgeschlagen | Andreas |
| ADR-02 | Frontend-Framework | **React** (Bestand Code + Handover); Vue-Reste entfernen | Vorgeschlagen | Andreas |
| ADR-03 | Datenbank und Hosting | **MongoDB beibehalten** (Bestandsentscheidung), aber **selbst betrieben in Deutschland** statt Atlas. Alternative PostgreSQL wäre wegen geringer Codebasis jetzt günstig wechselbar – nur auf ausdrückliche Entscheidung | Vorgeschlagen | Andreas |
| ADR-04 | Rezeptcode | Signierter Code (Ed25519) ohne Patientendaten; QR + PDF417 | Vorgeschlagen | Andreas / Security |
| ADR-05 | Deployment-Pfad | **Docker Compose** auf Hosts in Deutschland; Kubernetes/Helm/Terraform archivieren bis Bedarf | Vorgeschlagen | Andreas / DevOps |
| ADR-06 | Hybridmodell Papier + Code vs. rein elektronisch mit QES | MVP: Hybrid | Offen – rechtliche Prüfung | Andreas / Recht |
| ADR-07 | Security ID Card | FIDO2-Schlüssel mit NFC statt proprietärer Karte | Vorgeschlagen | Andreas / Security |
| ADR-08 | Zahlungsdienstleister | Stripe Billing als einziger PSP im MVP | Vorgeschlagen | Andreas |
| ADR-09 | Backend-Struktur | `src/backend` als Basis, TypeScript, modularer Monolith; `backend/`-Gerüst auflösen | Vorgeschlagen | Andreas / Entwicklung |
| ADR-10 | Zielmarkt | Deutschland; Österreich später | Vorgeschlagen | Andreas |
| ADR-11 | Datenschutzrollen | Auftragsverarbeitung für Praxis/Apotheke, eigene Verantwortung für QS – rechtlich zu bestätigen | Offen – rechtliche Prüfung | Andreas / DSB / Recht |
| ADR-12 | Apotheken-Preismodell | Prüffunktion für Apotheken kostenfrei/niedrigschwellig | Offen – Geschäftsentscheidung | Andreas |
| ADR-13 | Schlüsselspeicher | Vault/OpenBao selbst betrieben, HSM-Option | Vorgeschlagen | Security |
| ADR-14 | Umgang mit `.env.production` im Repo | Prüfen, bei echten Werten rotieren und aus Historie entfernen | **Dringend** | Andreas / Security |

ADRs werden einzeln in `docs/adr/NNNN-titel.md` nach einheitlicher Vorlage (Kontext, Entscheidung, Alternativen, Konsequenzen) festgehalten.

---

## 21. Umsetzungs-Roadmap mit Phasen-Gates

> Dauern sind **Größenordnungen unter der Annahme eines kleinen Kernteams** (2–4 Entwickler/innen plus anteilig Security, Recht, Datenschutz). Sie sind keine Zusage und müssen nach Teamplanung konkretisiert werden.

### Phase 0 – Fundament und Sanierung (ca. 4–6 Wochen)

**Ziel:** Saubere, ehrliche Ausgangsbasis.

- Sicherheits-Sofortmaßnahme `.env.production` (ADR-14)
- ADR-01 bis ADR-10 entscheiden und dokumentieren
- Repository-Sanierung (Anhang B): eine Backend-Struktur, React-Frontend, Workflow-Konsolidierung, Deployment-Pfad
- Abschlussbericht korrigieren bzw. als Planungsstand kennzeichnen
- Zweckbestimmung / MDR-Abgrenzung, VVT-Entwurf, DSFA-Start
- Bedrohungsmodell, Sicherheitsarchitektur, Schlüsselkonzept
- Entwicklungsumgebung, CI mit Pflicht-Checks, Staging-Umgebung
- Fachliche Klärungen: Pflichtangaben, Gültigkeit, Teileinlösung, Hybridmodell (ADR-06)

**Gate G0:** ADRs freigegeben · Repo bereinigt · CI grün · rechtliche Kernfragen beauftragt

### Phase 1 – MVP „Verify" (ca. 3–4 Monate)

**Ziel:** Ein Rezept kann echt ausgestellt, geprüft, eingelöst und nachgewiesen werden.

- `identity` (Organisationen, Nutzer, Rollen, MFA, FIDO2, Geräte), manuelles Onboarding
- `authorization` (Policy-Layer, Rechte-Matrix, Mandantentrennung)
- `prescription` (Entwurf, Ausstellung, Zustandsmaschine, Sperren, PDF mit QR/PDF417)
- `signing` (Ed25519, Schlüsselspeicher, Public-Key-Endpunkt)
- `verification` (Prüfung, Geburtsdatum-Abgleich, Token, atomare Einlösung, Storno, Ausfallbetrieb)
- `audit` (Hash-Kette, Abfrage, Verifikationswerkzeug)
- Praxis- und Apotheken-Oberfläche (Kernabläufe), DE
- Monitoring, Backup inkl. Restore-Test

**Gate G1:** Kern-E2E grün · Autorisierungsmatrix vollständig getestet · Nebenläufigkeitstest bestanden · interner Security-Review ohne High/Critical

### Phase 2 – Pilot (ca. 3 Monate)

**Ziel:** Echtbetrieb mit ausgewählten Partnern in einer Region.

- Pilotpartner: z. B. 5–10 Praxen und 15–30 Apotheken im selben Einzugsgebiet (Netzwerkeffekt)
- DSFA abgeschlossen, AVV, Datenschutzerklärungen, AGB, SLA
- **Externer Penetrationstest** vor Go-Live, Befunde behoben
- `licensing`, `billing` (Stripe, Rechnungen, Mahnwesen), Testlizenz
- RFC-3161-Zeitstempel, WORM-Archiv, Compliance-Berichte, Exporte
- Benachrichtigungszentrale, Changelog, EN-Sprachversion
- Sicherheitsstufen, JIT-Freigaben, Vier-Augen
- Regelbasierte QS (Grundregeln)
- Support-Prozess, Schulungsmaterial (Basis)
- Nutzerfeedback und Preisvalidierung

**Gate G2 (Go/No-Go Marktstart):** Pilot-KPIs (Kap. 24) erreicht · keine offenen High/Critical · Rechtsdokumente freigegeben · Betriebsprozesse erprobt (inkl. Incident-Übung)

### Phase 3 – Markteinführung und Ausbau (ca. 6 Monate)

- Regionale Ausweitung, Apotheken-Akquise
- QS-Score, Live-Monitor, Fallmanagement, Verdachtshinweis
- Patientenportal, Vertrauensperson, Einwilligungsverwaltung
- Pflichtschulungen mit Nachweis (SCORM), jährliche Wiederholung
- Praxis-Widget (Rezeptanfrage)
- Sicherheitsformulare / Bestellmodul (mit Druckpartner)
- Dark Mode, Favoriten, Aufgabenliste, mobile Optimierung

### Phase 4 – Integration und Skalierung (fortlaufend)

- Partner-API, PVS-/Warenwirtschafts-Integrationen
- Tiramizoo / Botendienste
- FHIR-Export, TI-Evaluation und ggf. Anbindung
- ML-gestützte Anomalieerkennung (nach KI-VO-Einordnung)
- ISO-27001-Vorbereitung, ggf. C5-Bewertung
- Weitere Sprachen, ggf. Österreich

### Backlog (nicht terminiert)

Videosprechstunde (über zertifizierten Partner), Patientenakte, Sprachsteuerung, Volltextsuche über Rezeptinhalte, Simulationsmodul, externe Kontrollinstanz/Beirat, Wissenschaftskooperation (nur mit anonymisierten Daten und eigener Rechtsgrundlage), Support-Chatbot.

---

## 22. Projektorganisation und Governance

### 22.1 Rollen im Projekt

| Rolle | Verantwortung | Besetzung |
|---|---|---|
| Product Owner / Projektleitung | Vision, Priorisierung, Abnahme, ADR-Entscheidungen | Dr. Andreas Tremml |
| Technische Leitung / Architektur | Architektur, Code-Qualität, ADR-Vorbereitung | [OFFEN] |
| Entwicklung | Umsetzung Backend/Frontend | `AT-Medical/devops-team` laut CODEOWNERS – Kapazität [OFFEN] |
| Security Owner | Sicherheitsarchitektur, Reviews, Pentest-Steuerung | `AT-Medical/security-team` – Person [OFFEN] |
| Infrastruktur / Betrieb | Hosting, Monitoring, Backup, Incident | `AT-Medical/infrastructure-team` – Person [OFFEN] |
| Datenschutzbeauftragte/r | DSFA, VVT, AVV, Beratung | [OFFEN] |
| Rechtsberatung | Pharmazie-, Berufs-, Datenschutz-, Vertragsrecht | Extern [OFFEN] |
| Fachbeirat | Ärztliche und pharmazeutische Praxisperspektive | Pilotpartner [OFFEN] |

### 22.2 RACI (Auszug)

| Aktivität | PO | Tech-Lead | Security | Betrieb | DSB | Recht |
|---|---|---|---|---|---|---|
| ADR-Entscheidung | A | R | C | C | C | C |
| Sicherheitsarchitektur | I | C | A/R | C | C | – |
| DSFA | A | C | C | C | R | C |
| Pentest-Freigabe | A | C | R | C | I | – |
| Go-Live-Entscheidung | A | R | C | R | C | C |
| Incident SEV1 | I | R | R | A | C | C |

(R = verantwortlich, A = rechenschaftspflichtig, C = konsultiert, I = informiert)

### 22.3 Arbeitsweise

- Zweiwöchige Iterationen, Review mit Demo, Retrospektive.
- Backlog in GitHub Issues/Projects mit Labels nach Modul, Phase, Schutzstufe; Templates vorhanden (`.github/ISSUE_TEMPLATE/*`).
- Monatlicher Steuerungstermin: Fortschritt gegen Roadmap, Risiken, Entscheidungen.
- Repository-Governance gemäß `metadata/repository-profile.yml` (security-class: high, Review- und Security-Review-Pflicht) bleibt bestehen.

---

## 23. Risikoregister

| # | Risiko | Wahrsch. | Auswirkung | Maßnahme | Owner |
|---|---|---|---|---|---|
| R1 | Zu geringe Apothekenteilnahme → kein Nutzen für Praxen | Hoch | Sehr hoch | Regionaler Pilot mit Netzwerkdichte, kostenfreie Prüffunktion, Verbandsansprache | PO |
| R2 | Ausweitung E-Rezept für PKV reduziert Markt | Mittel | Hoch | Fokussegmente, Mehrwertfunktionen, TI-Brücke als Option, regelmäßiges Marktmonitoring | PO |
| R3 | Rechtliche Unzulässigkeit oder Einschränkung des Modells (z. B. Hybridmodell, Datenschutzrollen) | Mittel | Sehr hoch | Frühzeitige anwaltliche Prüfung (Phase 0) als Gate | PO / Recht |
| R4 | Schlüsselkompromittierung | Niedrig | Sehr hoch | Schlüsselspeicher, Rotation, Widerrufsprozess, Notfallplan | Security |
| R5 | Datenschutzvorfall mit Gesundheitsdaten | Niedrig–Mittel | Sehr hoch | Feldverschlüsselung, Minimierung, Pentests, Incident-Prozess | Security / DSB |
| R6 | Kompromittiertes Arztkonto stellt Fälschungen aus | Mittel | Hoch | FIDO2, Gerätebindung, Anomalieerkennung, Notfallsperre | Security |
| R7 | Ausfall der Prüf-API im Apothekenbetrieb | Mittel | Hoch | Ausfallbetrieb offline, Redundanz, Monitoring, SLA | Betrieb |
| R8 | Überladener Scope verzögert MVP | Hoch | Hoch | Strikter Scope (ADR-01), Phasen-Gates | PO |
| R9 | Unzureichende Teamkapazität / Know-how | Mittel | Hoch | Kapazitätsplanung, externe Unterstützung für Security/Pentest | PO |
| R10 | Falsche Statusberichte (wie Abschlussbericht) führen zu Fehlentscheidungen | Mittel | Mittel | Status nur aus nachweisbaren Artefakten (CI, Releases, Testberichte) | PO / Tech-Lead |
| R11 | Lieferkettenangriff über Abhängigkeiten | Mittel | Hoch | SCA, Lockfiles, minimale Abhängigkeiten, SBOM | Security |
| R12 | Einstufung als Medizinprodukt durch Funktionserweiterung | Niedrig | Hoch | Zweckbestimmung, Change-Review gegen MDR-Abgrenzung | PO / Regulatory |
| R13 | Haftung bei Fehlprüfung | Mittel | Hoch | Klare Kommunikation des Prüfumfangs, AGB, Versicherung prüfen | PO / Recht |
| R14 | Versionierte Secrets im Repository | Unbekannt | Hoch | ADR-14 sofort | Security |

---

## 24. Kennzahlen und Erfolgsmessung

### 24.1 Pilot-KPIs (Gate G2)

| KPI | Zielwert (Vorschlag) |
|---|---|
| Anteil der Pilot-Rezepte, die bei Einlösung über PrescriptCheck geprüft wurden | ≥ 80 % |
| Mediane Prüfdauer in der Apotheke (Scan bis Ergebnis) | ≤ 10 Sekunden |
| Mediane Ausstellungsdauer in der Praxis | ≤ 60 Sekunden |
| Verfügbarkeit Prüf-API | ≥ 99,5 % |
| Sicherheitsvorfälle mit Datenabfluss | 0 |
| Zufriedenheit Pilotnutzer (Skala 1–5) | ≥ 4,0 |
| Zahlungsbereitschaft bestätigt (Praxen) | ≥ 60 % der Pilotpraxen |

### 24.2 Laufende Produkt-KPIs

- Aktive Praxen / Apotheken, Rezepte pro Monat, Prüfquote
- Erkannte Fälschungs- und Mehrfacheinlöseversuche
- Sperrungen und Reaktionszeit auf Verdachtsfälle
- Churn, Konversionsrate Testlizenz → Bezahllizenz
- Supportaufkommen je 1.000 Rezepte

### 24.3 Technische KPIs

- Deployment-Frequenz, Change-Failure-Rate, Mean Time to Recovery
- Offene Sicherheitsbefunde nach Schweregrad und Alter
- Testabdeckung kritischer Module, erfolgreiche Restore-Tests

---

## 25. Anhang A – Anforderungs-Traceability Handover → Konzept

| Handover-Anforderung | Konzept-Kapitel | Phase | Entscheidung |
|---|---|---|---|
| Seriennummer | 6.4 | 1 | Übernommen |
| QR/PDF417 verschlüsselt mit Prüfsumme | 6.4 | 1 | **Geändert:** signiert statt verschlüsselt |
| Zustände gültig/eingelöst/abgelaufen/gesperrt/final/gedruckt | 6.2 | 1 | Übernommen, fachlich bereinigt |
| Tokenbasierte Einlösungsfreigabe | 7.3 | 1 | Übernommen |
| Geburtsdatumprüfung | 7.3 | 1 | Übernommen (Abgleich statt Anzeige) |
| Arztsperre | 7.4 | 1 | Übernommen, inkl. Notfallsperre |
| Mehrfachauswahl, Filter, Export | 4.2, 7.7 | 1–2 | Übernommen |
| Audit mit Rolle/Gerät/Zeit/IP | 9.6 | 1 | Übernommen, IP-Kürzung nach Frist |
| Gerätebindung, Geräteübersicht | 9.3 | 1 | Übernommen (WebAuthn-basiert) |
| QS-Score | 10.3 | 3 | Übernommen, transparent, ohne Automatik-Sanktion |
| Verhaltensanomalie, KI-Prüfassistenz | 10.2, 10.5 | 2–4 | Übernommen, Regeln zuerst, kein pharmakologischer Rat |
| Live-Monitor | 10.4 | 3 | Übernommen |
| Automatische Sperren bei Missbrauch | 10.1 | 2–3 | Eingeschränkt: Rezept automatisch, Personen nur nach Prüfung |
| Mehrstufige Rollen/Zugriffe, NFC-Security-ID | 8, 9.3 | 1–2 | Übernommen, NFC → FIDO2 |
| Silent Alert / Notfallprotokoll / Polizei per TTS | 4.3, 7.8 | 3 | **Umgewidmet** zu stillem Verdachtshinweis |
| Wiederkehrende Schulungen | 7.10 | 3 | Übernommen |
| GxP-/ISO-/gematik-Vorbereitung | 9.8, 12, 15.5 | 4 | ISO 27001 als Option; GxP nicht einschlägig für Kernprodukt; gematik perspektivisch |
| Privacy by Design, Field-Level Encryption | 11.4, 9.4 | 1 | Übernommen |
| Lizenzmodelle Basic/Pro/Expert, Testlizenz | 16 | 2 | Übernommen, Preise offen |
| Stripe/PayPal/Klarna | 16.4 | 2 | Gebündelt über Stripe |
| Rechnungen, Upgrades, Verzugssperre | 16.5, 16.6 | 2 | Übernommen mit Patientenschutz-Grundsatz |
| Partner-API Lizenzverwaltung | 15.6 | 4 | Übernommen |
| Videosprechstunde | 4.2 | Backlog | Ausgegliedert |
| Patientenakte, Archiv, Historie, Export | 4.2, 19.2 | Backlog / 3 | Akte ausgegliedert; Rezepthistorie im Portal |
| Compliance-Reports, Prüfprotokolle, ZIP mit Passwort | 7.7 | 2 | Übernommen |
| Rezeptformular-Bestellung mit Wasserzeichen/Hologramm/Stempel | 7.9 | 3–4 | Übernommen |
| Benachrichtigungszentrale, Changelog, Upgrade-Modul | 7.6, 18.3 | 2 | Übernommen |
| Mehrsprachigkeit, Dark Mode, mobil | 19 | 2–3 | Übernommen |
| TI/API, Tiramizoo, Widget | 15 | 3–4 | Übernommen, phasenweise |
| Rollen Admin/Manager/Betreiber/User/Auditor/Supervisor/Controller | 8.2 | 1–2 | Übernommen, „Gott-Modus" ersetzt |
| Sicherheitsstufen 0–3 | 8.3 | 2 | Übernommen als Schutzklassen |
| Gegensignatur, zeitbegrenzte Freigaben | 8.4 | 2 | Übernommen |
| Vertrauensperson | 7.5 | 3 | Übernommen |
| DSGVO/NIS2/ePrivacy/ISO/KI-Gesetz/LkSG | 12 | 0–4 | Eingeordnet; HIPAA gestrichen |
| Exportmodul für Ermittlungsbehörden | 7.8 | 3 | Nur auf Rechtsgrundlage, Vier-Augen |
| Haftungsausschlüsse auf Prüfseiten | 12.2 | 1 | Übernommen |
| Forensische Protokolle | 9.6 | 1–2 | Über Audit-Trail |
| Quarantäne für Accounts | 10.1 | 3 | Übernommen mit menschlicher Prüfung |
| Honeypots / Fake-Rezepte | 4.3, 10.6 | – | **Nur Schulungsumgebung** |
| CERT-Reporting | 17.5 | 2 | Übernommen nach Anwendbarkeit |
| Blockchain-Backup | 4.3 | – | **Ersetzt** durch Hash-Kette + Zeitstempel + WORM |
| Zertifikatsbasierte Authentifizierung | 9.3 | 1 | Über FIDO2/WebAuthn |
| Sprachsteuerung, Volltextsuche, Simulationsmodul | 21 | Backlog | Zurückgestellt |
| Externe Kontrollinstanz, Beirat, Wissenschaft | 21, 22.1 | Backlog | Fachbeirat im Pilot |
| E-Mail-Template, Footer, Wiki, Handbücher | 19 | 1–3 | Übernommen |
| AT-Medical-Branding, Logo mit grünem Haken | 19.1 | 1 | Übernommen |
| Tooltip „i", Chatbot/Support-Button | 19.1, 21 | 2 / Backlog | Tooltip übernommen, Chatbot zurückgestellt |
| Hetzner, NGINX, PM2, Certbot, Cloud-Init, GitHub Actions | 13.3, 17.1 | 0–2 | Übernommen; PM2 entfällt im Container-Betrieb; Server-Ist live prüfen |
| GPS-Tracking (`ROADMAP.md`) | 4.3 | – | **Gestrichen** |

---

## 26. Anhang B – Repository-Sanierungsplan

> Dieser Plan beschreibt die Zielmaßnahmen. **Er wurde mit diesem Konzept nicht ausgeführt.** Jede Maßnahme erfolgt in einem eigenen, reviewten Pull Request.

| # | Maßnahme | Betroffene Pfade | Risiko |
|---|---|---|---|
| S1 | `.env.production` prüfen; ggf. Schlüssel rotieren, Datei aus Index entfernen, Historie bereinigen, `.gitignore` ergänzen | `.env.production`, `.gitignore` | Historienbereinigung erfordert Abstimmung mit allen Klonen |
| S2 | Ziel-Backend festlegen: `src/backend` als Basis, nach Modulschnitt (13.4) neu strukturieren; leeres `backend/`-Gerüst entfernen; `backend/package.json` und Lockfile übernehmen | `backend/`, `src/backend/`, `jest.config.js` | Gering (Gerüst leer) |
| S3 | Frontend: React festschreiben, `App.vue` entfernen, leere Dateien durch Implementierung oder Entfernung ersetzen, i18n-Dateien an einem Ort bündeln (`frontend/i18n` vs. `frontend/src/i18n`) | `frontend/` | Gering |
| S4 | Doppelte Root-Dateien bereinigen: `app.js`, `server.js`, `pm2.config.js` vs. `ecosystem.config.js` vs. `config/pm2.config.js`, `docker-compose.yml` vs. `docker/docker-compose.yml` vs. `config/docker-compose.yml`, `SECURITY.md` vs. `.github/SECURITY.md`, `CHANGELOG.md` vs. `docs/CHANGELOG.md` vs. `docs/changelog.md` | Root, `config/`, `docker/`, `docs/` | Mittel – Referenzen in Workflows prüfen |
| S5 | `config/` und `configs/` zusammenführen | `config/`, `configs/` | Gering |
| S6 | Deployment: Kubernetes/Helm/Terraform nach `deploy/_archive/` oder entfernen (ADR-05) | `deploy/` | Gering |
| S7 | Workflow-Konsolidierung (18.4) unter Prüfung der Branch-Schutzregeln | `.github/workflows/` | Mittel |
| S8 | HIPAA-Bezüge entfernen (Code, Tests, PR-Template, Doku) | `src/backend/compliance/hipaa.js`, `tests/compliance/hipaa.test.js`, `.github/PULL_REQUEST_TEMPLATE.md`, `docs/` | Gering |
| S9 | README und `docs/ARCHITECTURE.md` an Zielbild anpassen; Abschlussbericht als Planungsstand kennzeichnen | `README.md`, `docs/ARCHITECTURE.md`, `Abschlussbericht_*.md` | Gering – inhaltliche Freigabe durch Andreas |
| S10 | ADR-Ordner und Vorlage anlegen | `docs/adr/` | Keins |
| S11 | Leere Platzhalterdateien und `.placeholder` entfernen, sobald Struktur steht | Gesamt | Gering |
| S12 | `ROADMAP.md` an Kapitel 21 angleichen (u. a. GPS streichen) | `ROADMAP.md` | Gering |

---

## 27. Anhang C – Glossar

| Begriff | Erläuterung |
|---|---|
| ABAC | Attribute-Based Access Control – Zugriffsentscheidung anhand von Attributen (Kontext) |
| ADR | Architecture Decision Record – dokumentierte Architekturentscheidung |
| AMVV | Arzneimittelverschreibungsverordnung |
| ApBetrO | Apothekenbetriebsordnung |
| AVV | Auftragsverarbeitungsvertrag nach Art. 28 DSGVO |
| Break-Glass | Kontrollierter Notfallzugang mit Vier-Augen und Vollprotokollierung |
| C5 | Cloud Computing Compliance Criteria Catalogue des BSI |
| Crypto-Shredding | Unlesbarmachen von Daten durch Vernichtung des Schlüssels |
| DSFA | Datenschutz-Folgenabschätzung nach Art. 35 DSGVO |
| eHBA / SMC-B | Elektronischer Heilberufsausweis / Institutionskarte der TI |
| Ed25519 | Verfahren für digitale Signaturen auf Basis elliptischer Kurven |
| FIDO2 / WebAuthn | Standard für phishing-resistente Authentisierung mit Sicherheitsschlüsseln oder Geräten |
| FHIR | Fast Healthcare Interoperability Resources (HL7-Standard) |
| HV-Tisch | Handverkaufstisch der Apotheke |
| JIT | Just-in-Time – zeitlich befristete Rechtevergabe |
| MDR | EU-Medizinprodukteverordnung 2017/745 |
| PDF417 | Zweidimensionaler Stapelbarcode, verbreitet bei Apotheken-Scannern |
| PVS | Praxisverwaltungssystem |
| QES | Qualifizierte elektronische Signatur |
| RFC 3161 | Standard für vertrauenswürdige Zeitstempel |
| RPO / RTO | Recovery Point Objective / Recovery Time Objective |
| SBOM | Software Bill of Materials |
| TI | Telematikinfrastruktur des deutschen Gesundheitswesens (gematik) |
| VVT | Verzeichnis von Verarbeitungstätigkeiten nach Art. 30 DSGVO |
| WORM | Write Once, Read Many – unveränderlicher Speicher |

---

*Dieses Dokument ist vertraulich und ausschließlich für den internen Gebrauch durch AT Medical GmbH und autorisierte Vertragspartner bestimmt. Rechtliche Einordnungen sind fachliche Vorbewertungen und ersetzen keine Rechtsberatung.*
