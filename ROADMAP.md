# Roadmap: PrescriptCheck

Maßgeblich ist das [Gesamtkonzept, Kapitel 21](docs/konzept/PrescriptCheck_Gesamtkonzept.md). Der aktuelle Stand steht in
[docs/mvp/README.md](docs/mvp/README.md). Diese Datei ersetzt eine frühere Fassung, die Funktionen als erledigt markierte,
die im Code nicht vorhanden waren (u. a. Lizenzsystem, PDF417).

## Phase 0 – Fundament (teilweise)
- [x] Gesamtkonzept, Entscheidungen (ADR)
- [ ] Repository-Bereinigung (Altbestand, doppelte Workflows/Deployments) – wartet auf Freigabe
- [ ] `.env.production` im Git prüfen (ggf. Schlüssel rotieren, Historie bereinigen)
- [ ] GitHub Actions lauffähig machen (Abrechnung/Ausgabenlimit), Workflows konsolidieren

## Phase 1 – MVP „Verify“ (Funktionsumfang umgesetzt, nicht pilotreif)
- [x] Ausstellen mit Seriennummer und digitaler Signatur (Ed25519), Druck als PDF mit QR-Code
- [x] Zustandsmaschine: Entwurf, gültig, gesperrt, eingelöst, abgelaufen
- [x] Prüfung durch Apotheken (Ampel), Identitätsabgleich per Geburtsdatum, atomare Einmal-Einlösung, Storno
- [x] Sperren (einzeln, mehrfach, Notfallsperre), Verdachtsmeldung, QS-Ansicht ohne Patientendaten
- [x] Feldverschlüsselung, Mandantentrennung, Rechtematrix, TOTP, manipulationsgeschütztes Audit-Log
- [ ] Test gegen echte MongoDB, Docker-Stack auf Staging, Praxistest mit Drucker/Scanner/Handy

## Phase 2 – Pilot (offen)
- [ ] Externer Penetrationstest, DSFA, AVV, Datenschutzerklärung, AGB/SLA, rechtliche Klärungen
- [ ] Lizenzen, Zahlung (Stripe), Rechnungen, Testlizenz
- [ ] RFC-3161-Zeitstempel, WORM-Archiv, Compliance-Berichte, E-Mail-Versand
- [ ] Sicherheitsstufen, Vier-Augen, FIDO2/WebAuthn, Gerätebindung
- [ ] Löschkonzept und Betroffenenrechte, Monitoring/Alarmierung, getesteter Restore

## Phase 3 – Markteinführung (offen)
- [ ] QS-Score, Live-Monitor, Patientenportal, Vertrauensperson
- [ ] Pflichtschulungen (SCORM), Praxis-Widget, Sicherheitsformulare, PDF417

## Phase 4 – Integration und Skalierung (offen)
- [ ] Partner-API, PVS-/Warenwirtschafts-Integration, Tiramizoo, FHIR-Export
- [ ] TI-Evaluation, ML-gestützte Anomalieerkennung (nach KI-VO-Einordnung), ISO 27001

## Gestrichen / ersetzt (Begründung im Konzept, Kap. 4.3)
GPS-Tracking, automatische Polizei-Alarmierung, Honeypot-Rezepte im Echtbetrieb, Blockchain-Backup, „Gott-Modus“ für Administratoren.
