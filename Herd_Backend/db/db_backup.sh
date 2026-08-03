#!/bin/bash
# Herd AI - PostgreSQL Automated Backup Script

# Set configuration variables
BACKUP_DIR="/var/backups/herd_postgres"
DB_CONTAINER="postgres-db"
DB_USER="postgres"
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/backup_$DATE.sql.gz"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Run pg_dump inside the postgres container and gzip the output
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d Collar_to_Gateway | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "[$(date)] Backup successful: $BACKUP_FILE"
    
    # Optional: Delete backups older than 30 days
    find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +30 -exec rm {} \;
else
    echo "[$(date)] Backup failed!"
    exit 1
fi
