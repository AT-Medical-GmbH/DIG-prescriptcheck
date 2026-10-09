# ADR-0001: Entscheidungen für den MVP

- **Status:** umgesetzt (Entscheidung auf Anweisung der Projektleitung: „selbstständig eigenverantwortlich bis zum MVP abarbeiten“; die
  im Gesamtkonzept empfohlenen Entscheidungen wurden übernommen, Abweichungen sind unten aufgeführt)
- **Datum:** 09.10.2026
- **Bezug:** [Gesamtkonzept](../konzept/PrescriptCheck_Gesamtkonzept.md), Kap. 20

| ADR (Konzept) | Entscheidung | Umsetzung / Abweichung |
|---|---|---|
| ADR-01 Produktfokus | Kern „Ausstellen – Prüfen – Einlösen – Nachweisen“ | Umgesetzt. Gestrichene/umgewidmete Anforderungen (Konzept 4.3) wurden nicht implementiert |
| ADR-02 Frontend | React | Umgesetzt (React 19, Vite). Vue-Reste im Altbestand bleiben bis zur Bereinigung |
| ADR-03 Datenbank | MongoDB, selbst betrieben in Deutschland | Store-Abstraktion mit MongoDB-Implementierung; gegen echte MongoDB 7 getestet (464 Tests, siehe MVP-Doku A1) |
| ADR-04 Rezeptcode | Signiert (Ed25519), ohne Patientendaten | Umgesetzt als kompakt-binärer Code (131 Zeichen); nur QR, kein PDF417; `iss` nicht im Code |
| ADR-05 Deployment | Docker Compose, Server in Deutschland | Dateien vorhanden (`deploy/mvp`), in Sandbox getestet, auf echtem Server noch offen (MVP-Doku A2) |
| ADR-06 Hybridmodell Papier + Code | Papier mit Unterschrift bleibt maßgeblich | Umgesetzt (Druckbild mit Unterschriftsfeld); **rechtliche Bestätigung offen** |
| ADR-07 Security-Karte | FIDO2 statt eigener Karte | **Nicht umgesetzt**; TOTP als Zwischenlösung |
| ADR-08 Zahlungsdienstleister | Stripe als einziger PSP | Nicht Teil des MVP |
| ADR-09 Backend-Struktur | `src/backend`, TypeScript | **Abweichung:** `backend/src`, JavaScript (siehe Begründung in der MVP-Doku, Abschnitt 8) |
| ADR-10 Zielmarkt | Deutschland | Umgesetzt (Texte, Zeitzone, Datumsformate); HIPAA-Bezüge im Altbestand unberührt |
| ADR-11 Datenschutzrollen | AV für Praxis/Apotheke, QS eigene Verantwortung | **Rechtliche Bestätigung offen**; technisch: QS sieht keine Gesundheitsdaten |
| ADR-12 Apotheken-Preismodell | Prüffunktion niedrigschwellig | Nicht Teil des MVP (keine Lizenzierung) |
| ADR-13 Schlüsselspeicher | Vault/OpenBao | Nicht umgesetzt; Schlüssel aus Umgebungsvariablen (nur Pilot-Übergang) |
| ADR-14 `.env.production` im Repo | Prüfen, ggf. rotieren und Historie bereinigen | **Offen – Handlung der Projektleitung/Security erforderlich** |

## Zusätzliche Entscheidungen während der Umsetzung

1. **Keine neuen Abhängigkeiten.** QR-Encoder, PDF-Writer, TOTP, Passwort-Hashing (scrypt) und Eingabevalidierung sind eigene, getestete
   Module auf Basis der Node-Standardbibliothek. Vorteil: kleine Angriffsfläche in der Lieferkette. Nachteil: eigener Wartungsaufwand
   (der QR-Encoder ist durch Referenzvergleich abgesichert).
2. **Identitätsabgleich vor Inhaltsanzeige** (strenger als die Skizze im Konzept 7.3): Wer nur den Code besitzt, sieht keine Gesundheitsdaten.
3. **Seriennummer erst beim Ausstellen**, nicht beim Anlegen des Entwurfs.
4. **Audit-Schreibzugriffe je Kette serialisiert** (Warteschlange im Prozess) plus bedingtes Update des Kettenkopfs für mehrere Instanzen –
   ein Test mit 20 parallelen Schreibvorgängen hatte die ursprüngliche rein optimistische Variante als unzureichend entlarvt.
5. **Zugang-zurücksetzen durch Administratoren** als Wiederherstellungsweg (Passwort/2FA), weil E-Mail-Versand noch fehlt.
6. **Sitzungsprüfung bei jeder Anfrage** gegen den Server (nicht nur JWT-Signatur), damit Abmeldung, Deaktivierung und Zurücksetzen sofort wirken.
7. **Zugangseinrichtung (Passwortwechsel, 2FA) wird pro Route erzwungen**, nicht per URL-Muster (ein früherer Entwurf war per Query-String umgehbar; Test vorhanden).
