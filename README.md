⚠️ **This repository is source-available but not open source. All rights are reserved by AT Medical GmbH.**

---

<p align="center">
  <img src="assets/logo.PNG" alt="PrescriptCheck Logo" width="200"/>
</p>

<p align="center">
  <strong>PrescriptCheck</strong> ist eine digitale Plattform zur Validierung von Privatrezepten in Deutschland. Ziel ist es, Apotheken eine sichere Möglichkeit zu geben, die Echtheit und Gültigkeit eines Rezepts zu überprüfen – datenschutzkonform, revisionssicher und praxisnah.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/type-product-blue?style=flat-square" alt="type: product"/>
  <img src="https://img.shields.io/badge/domain-medical--software-green?style=flat-square" alt="domain: medical-software"/>
  <img src="https://img.shields.io/badge/visibility-private-red?style=flat-square" alt="visibility: private"/>
  <img src="https://img.shields.io/badge/status-active-brightgreen?style=flat-square" alt="status: active"/>
  <img src="https://img.shields.io/badge/deploy-vps%20%7C%20r2-orange?style=flat-square" alt="deploy: vps | r2"/>
  <img src="https://img.shields.io/badge/team-admin-blueviolet?style=flat-square" alt="team: admin"/>
  <img src="https://img.shields.io/badge/team-security--critical-red?style=flat-square" alt="team: security-critical"/>
</p>

---

## Features

- Digitale Rezeptprüfung mit QR-Code oder Seriennummer  
- Statusverwaltung: gültig, eingelöst, gesperrt, abgelaufen  
- PDF417-Barcode-Generierung und Validierung  
- Apothekenprüfung mit Echtzeit-Statusabfrage  
- Benutzerrollen: Arzt, Apotheke, Admin  
- Lizenz- und Zahlungsabwicklung (Stripe, PayPal, Klarna)  
- Telemedizin-Modul (Videoberatung)  
- SCORM-kompatible Lernmodule für medizinisches Fachpersonal  
- Mehrsprachige Oberfläche  
- PM2- und Docker-Deployment  
- GitHub Actions CI/CD Workflows  

---

## Projektstruktur

```
/backend            → Node.js (Express) API (Quellcode in backend/src)
/frontend           → React-App mit Vite (Quellcode in frontend/app)
/scripts            → Shell-Skripte für Deployment, SSL, Seeding
/docs               → Dokumentation, Architektur, Indexseiten
/scorm              → SCORM Module für Weiterbildung
/configs            → Shared configuration templates
/tests              → Automatisierte Tests
/metadata           → ATMED Repository-Profil und Enterprise-Tagging
/artifacts          → CI/CD Build-Artefakte (nicht eingecheckt)
.github/workflows   → CI/CD Konfiguration (GitHub Actions)
pm2.config.js       → Prozessmanager-Konfiguration (PM2)
Dockerfile          → Docker-Build-Anleitung
docker-compose.yml  → Lokale Multi-Service-Entwicklung
.env.example        → Beispiel für Produktionskonfiguration
```

---

## Setup

### 1. Klonen & Installieren

```bash
git clone https://github.com/ATMedicalGmbH/PrescriptCheck.git
cd PrescriptCheck
npm install
```

### 2. Umgebungsvariablen

Erstelle eine Datei `.env.production` auf Basis der Vorlage `.env.example`:

```env
NODE_ENV=production
PORT=3000
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/prescriptcheck
JWT_SECRET=your_jwt_secret
STRIPE_SECRET_KEY=sk_live_xxx
SMTP_HOST=smtp.example.com
SMTP_USER=mailer@example.com
SMTP_PASS=securepassword
```

---

## Lokaler Start

### Entwicklung:

```bash
npm run dev         # Frontend via Vite
npm run backend     # Backend via Node.js
```

### Produktion mit PM2:

```bash
pm2 start pm2.config.js
```

### Produktion mit Docker:

```bash
docker build -t prescriptcheck .
docker run -p 3000:3000 prescriptcheck
```

### Mit Docker Compose:

```bash
docker-compose up --build
```

---

## Sicherheit & Datenschutz

PrescriptCheck wurde nach dem Prinzip der „Security by Design“ und „Privacy by Default“ entwickelt. Zu den zentralen Maßnahmen gehören:

- Kein Speichern personenbezogener Daten ohne Notwendigkeit  
- AES-verschlüsselte PDF417-Barcodes auf Rezepten  
- Passwortrichtlinien mit Mindestkomplexität und Validierung  
- Vollständige Trennung zwischen Arzt- und Apothekenbereich  
- Validierung von Rezepten nur über eindeutige Signatur & Zeitstempel  
- Unterstützung von Zwei-Faktor-Authentifizierung (2FA)  
- DSFA-konforme Risikobewertung dokumentiert  
- Logging & Audit-Tracking für alle sensiblen Aktionen  

---

## .gitignore (Empfehlung)

```gitignore
node_modules/
.env
.env.production
.env.example
dist/
.vscode/
logs/
*.log
```

---

## GitHub Actions CI/CD

### 1. CI: Build & Test Workflow (`ci.yml`)

```yaml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - run: cd frontend && npm install && npm run build
      - run: npm run backend &
      - run: sleep 5 && curl --fail http://localhost:3000 || exit 1
```

### 2. Release Workflow (`release.yml`)

```yaml
name: Create Release
on:
  push:
    tags:
      - 'v*.*.*'
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: cd frontend && npm install && npm run build
      - uses: softprops/action-gh-release@v1
        with:
          generate_release_notes: true
```

### 3. Docker Deployment Workflow (`docker.yml`)

```yaml
name: Build and Push Docker Image
on:
  push:
    branches: [ main ]
jobs:
  docker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: yourdockerhubname/prescriptcheck:latest
```

### 4. SSH Deployment Workflow (`deploy.yml`)

```yaml
name: Deploy to Server
on:
  push:
    branches:
      - main
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: sudo apt-get install openssh-client -y
      - uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_IP }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /home/ubuntu/prescriptcheck
            git pull
            npm install
            pm2 restart prescriptcheck
```

---

## Lizenz

Diese Software ist urheberrechtlich geschützt und unterliegt einem kommerziellen Lizenzmodell der AT Medical GmbH.  
Jegliche **Kopien, Modifikationen, Weiterverwendungen oder Veröffentlichungen – auch auszugsweise – sind ausdrücklich untersagt**, sofern keine schriftliche Genehmigung durch die Rechteinhaberin vorliegt.

**Achtung:** PrescriptCheck ist ausschließlich für den Einsatz durch lizenzierte Vertragspartner bestimmt. Die Nutzung in medizinischen Kontexten unterliegt den jeweils geltenden gesetzlichen Vorgaben.  
Jegliche missbräuchliche oder nicht autorisierte Nutzung – insbesondere zur Rezeptfälschung oder zur Umgehung gesetzlicher Anforderungen – kann rechtlich verfolgt werden.

---

## Kontakt

**Projektleitung:** Dr. Andreas Tremml  
**Support:** support@at-medical.de  
**Webseite:** [www.at-medical.de](https://www.at-medical.de)

---

## Versionsinfo

| Feld | Wert |
|---|---|
| **Version** | 0.9.0 |
| **Datum** | 2026-03-16 |
| **Status** | Verified |
| **Repository** | DIG-prescriptcheck / PrescriptCheck |
| **Owner** | AT Medical GmbH |
| **Security Class** | High |
