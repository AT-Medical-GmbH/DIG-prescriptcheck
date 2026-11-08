#!/usr/bin/env bash
# Verschlüsseltes MongoDB-Backup (täglich per Cron, siehe README). Aufruf aus deploy/mvp.
#   BACKUP_DIR=/var/backups/prescriptcheck BACKUP_KEY_FILE=/root/.prescriptcheck-backup.key ./backup.sh
# WICHTIG: Das Backup enthält verschlüsselte Gesundheitsdaten. Ohne MASTER_KEY und
# SIGNING_PRIVATE_KEY (separat und getrennt vom Backup sichern!) ist es nicht verwendbar.
set -euo pipefail
cd "$(dirname "$0")"
# .env wird NICHT als Shell-Skript ausgeführt (Sonderzeichen, Code-Ausführung), sondern gezielt gelesen
envval() { grep -E "^$1=" .env | tail -n1 | cut -d= -f2-; }
MONGO_ROOT_USER="$(envval MONGO_ROOT_USER)"; MONGO_ROOT_PASSWORD="$(envval MONGO_ROOT_PASSWORD)"
[ -n "$MONGO_ROOT_USER" ] && [ -n "$MONGO_ROOT_PASSWORD" ] || { echo "MONGO_ROOT_USER/MONGO_ROOT_PASSWORD fehlen in .env" >&2; exit 1; }
BACKUP_DIR="${BACKUP_DIR:-/var/backups/prescriptcheck}"
BACKUP_KEY_FILE="${BACKUP_KEY_FILE:?BACKUP_KEY_FILE (Schlüsseldatei für die Verschlüsselung) setzen}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
[ -s "$BACKUP_KEY_FILE" ] || { echo "Schlüsseldatei fehlt oder ist leer: $BACKUP_KEY_FILE" >&2; exit 1; }
[ "$(stat -c %a "$BACKUP_KEY_FILE")" = "600" ] || { echo "Schlüsseldatei muss Rechte 600 haben: $BACKUP_KEY_FILE" >&2; exit 1; }
umask 077
mkdir -p "$BACKUP_DIR"
OUT="$BACKUP_DIR/prescriptcheck-$(date -u +%Y%m%dT%H%M%SZ).archive.gz.enc"
docker compose exec -T mongo mongodump --quiet --archive --gzip \
  -u "$MONGO_ROOT_USER" -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin --db prescriptcheck \
  | openssl enc -aes-256-cbc -pbkdf2 -salt -pass "file:$BACKUP_KEY_FILE" > "$OUT"
[ -s "$OUT" ] || { echo "Backup leer – abgebrochen" >&2; rm -f "$OUT"; exit 1; }
# Entschlüsselbarkeit sofort prüfen (ein Backup, das sich nicht öffnen lässt, ist keines)
openssl enc -d -aes-256-cbc -pbkdf2 -pass "file:$BACKUP_KEY_FILE" -in "$OUT" | head -c 16 | grep -q . \
  || { echo "Backup lässt sich nicht entschlüsseln – abgebrochen" >&2; rm -f "$OUT"; exit 1; }
find "$BACKUP_DIR" -name 'prescriptcheck-*.archive.gz.enc' -mtime "+$RETENTION_DAYS" -delete
echo "Backup geschrieben: $OUT ($(du -h "$OUT" | cut -f1))"
# Wiederherstellung (Testsystem!):
#   openssl enc -d -aes-256-cbc -pbkdf2 -pass file:$BACKUP_KEY_FILE -in <datei> | \
#     docker compose exec -T mongo mongorestore --archive --gzip -u ... -p ... --authenticationDatabase admin --drop
