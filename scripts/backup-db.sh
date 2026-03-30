#!/bin/bash

# Configuration
BACKUP_DIR="./backups"
DB_FILE="./prisma/lasecre.db" # Ruta relativa al fitxer de BD
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/lasecre_$TIMESTAMP.db"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Copy database
# Nota: Si el bot està corrent, és millor usar .backup de sqlite3 per evitar corrupció
if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$DB_FILE" ".backup '$BACKUP_FILE'"
else
    cp "$DB_FILE" "$BACKUP_FILE"
fi

# Keep only the last 7 days of backups
find "$BACKUP_DIR" -name "lasecre_*.db" -mtime +7 -delete

echo "Backup completat a: $BACKUP_FILE"
