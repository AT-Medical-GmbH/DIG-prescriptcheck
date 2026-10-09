#!/usr/bin/env bash
# Verschlüsseltes MongoDB-Backup (täglich per Cron, siehe README). Aufruf aus deploy/mvp.
#   BACKUP_DIR=/var/backups/prescriptcheck BACKUP_KEY_FILE=/root/.prescriptcheck-backup.key ./backup.sh
# WICHTIG: Das Backup enthält verschlüsselte Gesundheitsdaten. Ohne MASTER_KEY und
# SIGNING_PRIVATE_KEY (separat und getrennt vom Backup sichern!) ist es nicht verwendbar.
set -euo pipefail
cd "$(dirname "$0")"
set -a; . ./.env; set +a
BACKUP_DIR="${BACKUP_DIR:-/var/backups/prescriptcheck}"
BACKUP_KEY_FILE="${BACKUP_KEY_FILE:?BACKUP_KEY_FILE (Schlüsseldatei für die Verschlüsselung) setzen}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
umask 077
mkdir -p "$BACKUP_DIR"
OUT="$BACKUP_DIR/prescriptcheck-$(date -u +%Y%m%dT%H%M%SZ).archive.gz.enc"
docker compose exec -T mongo mongodump --quiet --archive --gzip \
  -u "$MONGO_ROOT_USER" -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin --db prescriptcheck \
  | openssl enc -aes-256-cbc -pbkdf2 -salt -pass "file:$BACKUP_KEY_FILE" > "$OUT"
[ -s "$OUT" ] || { echo "Backup leer – abgebrochen" >&2; rm -f "$OUT"; exit 1; }
find "$BACKUP_DIR" -name 'prescriptcheck-*.archive.gz.enc' -mtime "+$RETENTION_DAYS" -delete
echo "Backup geschrieben: $OUT ($(du -h "$OUT" | cut -f1))"
# Wiederherstellung (Testsystem!):
#   openssl enc -d -aes-256-cbc -pbkdf2 -pass file:$BACKUP_KEY_FILE -in <datei> | \
#     docker compose exec -T mongo mongorestore --archive --gzip -u ... -p ... --authenticationDatabase admin --drop
