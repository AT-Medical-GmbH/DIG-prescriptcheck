#!/bin/sh
# Legt beim ERSTEN Start des Mongo-Containers (leeres Datenvolumen) den Anwendungsbenutzer an:
# Rechte nur auf die Datenbank "prescriptcheck" (readWrite), keine Administrationsrechte.
# Für ein bereits initialisiertes Volumen siehe README ("Anwendungsbenutzer nachrüsten").
set -eu
mongosh --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin <<EOF
db = db.getSiblingDB('prescriptcheck');
db.createUser({ user: '${MONGO_APP_USER}', pwd: '${MONGO_APP_PASSWORD}', roles: [{ role: 'readWrite', db: 'prescriptcheck' }] });
EOF
