# PrescriptCheck – Server-Betrieb (MVP, Docker Compose)

> **Status: ungetestet.** Diese Dateien (Dockerfiles, Compose, NGINX, Backup-Skript) konnten in der Entwicklungsumgebung
> nicht ausgeführt werden (kein Docker-Daemon). Der Anwendungscode ist getestet, der Container-Stack **noch nicht**.
> Erster Durchlauf bitte auf einem **Staging-Server mit erfundenen Daten**, nicht direkt produktiv.

Zielbild laut Konzept (Kap. 13/17): Server in Deutschland, nur Port 80/443 offen, Datenbank nicht öffentlich erreichbar,
Administration über VPN/Bastion. Servername, IP, DNS und Anbieter sind **nicht belastbar dokumentiert** und werden hier nicht
vorausgesetzt – `<DOMAIN>` steht für die bereits angelegte Domain.

## Bestandteile

| Dienst | Image | Aufgabe |
|---|---|---|
| `mongo` | `mongo:7` | Datenbank mit Authentifizierung, **kein** veröffentlichter Port |
| `backend` | eigenes Image (`Dockerfile.backend`) | API, läuft als Nicht-Root-Nutzer, nur intern erreichbar |
| `web` | eigenes Image (`Dockerfile.web`) | NGINX: TLS, Sicherheits-Header, Rate-Limits, statisches Frontend, Proxy auf `/api` |

## Voraussetzungen

- Server mit aktueller Ubuntu-LTS, Docker Engine inkl. Compose-Plugin, `git`, `certbot`
- DNS: A-/AAAA-Eintrag von `<DOMAIN>` auf den Server
- Firewall: eingehend nur 80/443 (SSH ausschließlich über VPN/Bastion), kein Zugriff auf 27017
- Regelmäßige Sicherheitsupdates des Betriebssystems aktivieren (`unattended-upgrades`)

## Erstinstallation

```bash
# 1. Code holen
sudo mkdir -p /opt/prescriptcheck && sudo chown "$USER" /opt/prescriptcheck
git clone https://github.com/AT-Medical-GmbH/DIG-prescriptcheck.git /opt/prescriptcheck
cd /opt/prescriptcheck/deploy/mvp

# 2. Geheimnisse erzeugen (nur Node nötig, keine Installation)
docker run --rm -v "$PWD/../../backend/src/scripts:/s:ro" node:22-alpine node /s/generateSecrets.js
#    → JWT_SECRET, MASTER_KEY, SIGNING_KEY_ID, SIGNING_PRIVATE_KEY

# 3. Konfiguration anlegen und schützen
cp .env.example .env && chmod 600 .env
nano .env        # DOMAIN, Mongo-Passwort und die erzeugten Geheimnisse eintragen

# 4. TLS-Zertifikat (Port 80 muss frei sein, der Stack läuft noch nicht)
sudo mkdir -p /var/www/certbot
sudo certbot certonly --standalone -d <DOMAIN> \
  --pre-hook  "docker compose -f /opt/prescriptcheck/deploy/mvp/docker-compose.yml stop web || true" \
  --post-hook "docker compose -f /opt/prescriptcheck/deploy/mvp/docker-compose.yml start web || true"
#    Die Hooks werden für die automatische Erneuerung (systemd-Timer von certbot) gespeichert.

# 5. Stack bauen und starten
docker compose up -d --build
docker compose ps            # alle Dienste "healthy"/"running"
docker compose logs -f backend

# 6. Erstes Plattform-Admin-Konto (Initialpasswort wird einmalig ausgegeben)
docker compose exec -e ADMIN_EMAIL=admin@<DOMAIN> -e ADMIN_NAME="Plattform-Administration" backend node src/scripts/createPlatformAdmin.js
```

Danach im Browser `https://<DOMAIN>` öffnen: Passwort ändern, Zwei-Faktor-Authentifizierung einrichten (Pflicht), unter
„Organisationen“ Praxen/Apotheken anlegen (nach manueller Prüfung von Approbation bzw. Betriebserlaubnis) und unter „Nutzer“
deren Administratoren anlegen.

## Geheimnisse und Schlüssel – bitte ernst nehmen

| Geheimnis | Folge bei Verlust |
|---|---|
| `MASTER_KEY` | **Alle verschlüsselten Rezept-/Patientendaten sind unwiederbringlich verloren**, auch aus Backups |
| `SIGNING_PRIVATE_KEY` | Neue Rezepte können nicht mehr signiert werden; bereits ausgestellte bleiben mit dem öffentlichen Schlüssel prüfbar |
| `JWT_SECRET` | Alle Sitzungen werden ungültig (unkritisch) |

- `MASTER_KEY` und `SIGNING_PRIVATE_KEY` **zusätzlich offline und getrennt vom Datenbank-Backup** sichern (z. B. versiegelter Umschlag im Tresor, Vier-Augen-Zugang).
- Zielbild: Schlüssel in einem Schlüsselspeicher (Vault/OpenBao/HSM) statt in `.env` (Konzept 9.4).
- Rotation des Signaturschlüssels: neues Schlüsselpaar erzeugen, `SIGNING_KEY_ID` erhöhen, alten **öffentlichen** Schlüssel in `SIGNING_PUBLIC_KEYS_JSON` aufnehmen. Bereits gedruckte Rezepte bleiben prüfbar.

## Backup und Wiederherstellung

```bash
# Schlüsseldatei für die Backup-Verschlüsselung (einmalig, getrennt aufbewahren)
sudo sh -c 'umask 077; head -c 48 /dev/urandom | base64 > /root/.prescriptcheck-backup.key'

# Täglich um 02:15 Uhr (Cron von root)
15 2 * * * cd /opt/prescriptcheck/deploy/mvp && BACKUP_KEY_FILE=/root/.prescriptcheck-backup.key ./backup.sh >> /var/log/prescriptcheck-backup.log 2>&1
```

- Backups liegen standardmäßig unter `/var/backups/prescriptcheck` (14 Tage). **Zusätzlich an einen zweiten Standort in Deutschland kopieren.**
- **Ein Backup gilt erst als vorhanden, wenn die Wiederherstellung getestet wurde** – mindestens monatlich auf einem Testsystem (Befehl am Ende von `backup.sh`).

## Aktualisierung und Rückfall

```bash
cd /opt/prescriptcheck && git fetch && git checkout <Release-Tag>
cd deploy/mvp && ./backup.sh && docker compose up -d --build
# Rückfall: vorherigen Tag auschecken und erneut "docker compose up -d --build"
# (Der MVP hat keine Schema-Migrationen; spätere Versionen führen sie vorwärtskompatibel ein.)
```

## Staging / Schulung (nur erfundene Daten)

Eigenes Verzeichnis/Projekt (`docker compose -p prescriptcheck-staging …`), eigene Subdomain, **eigene Geheimnisse**, in `.env`:
`NODE_ENV=staging`, `SEED_DEMO=true`. Die Demo-Konten (`*@demo.prescriptcheck.test`) und das Passwort stehen in
`backend/src/scripts/seedDemo.js`. In Produktion verweigert das Backend den Start, wenn `SEED_DEMO` gesetzt ist.
**Produktionsdaten dürfen niemals in Staging kopiert werden.**

## Prüfliste nach dem Start

- [ ] `https://<DOMAIN>` lädt, HTTP leitet auf HTTPS um, Zertifikat gültig
- [ ] `curl -I https://<DOMAIN>/api/v1/prescriptions` → `401`, Header `Strict-Transport-Security`, `Cache-Control: no-store`
- [ ] `https://<DOMAIN>/.well-known/prescriptcheck/keys` liefert den öffentlichen Schlüssel
- [ ] Port 27017 von außen **nicht** erreichbar (`nmap`/Anbieter-Firewall)
- [ ] Testlauf: Rezept ausstellen → drucken → mit Handy/Scanner den QR-Code lesen → in der Apotheken-Ansicht prüfen und einlösen
- [ ] Audit-Kette unter „Audit-Protokoll“ → „Integrität prüfen“ ist intakt
- [ ] Backup erzeugt **und** auf Testsystem wiederhergestellt
