#!/usr/bin/env bash
# Runs DB schema push + trigger creation + seed.
# Called by start.sh and learn-auto-update.service.
set -e

DIR="$(cd "$(dirname "$(dirname "$0")")" && pwd)"
cd "$DIR"

echo "=== Running DB setup ==="

# Push any schema changes
npx prisma db push --accept-data-loss

# Create auto-activate-ADMIN trigger
sqlite3 prisma/dev.db "
CREATE TRIGGER IF NOT EXISTS auto_activate_admin
AFTER INSERT ON User
WHEN NEW.role = 'ADMIN'
BEGIN
  UPDATE User SET active = 1 WHERE id = NEW.id;
END;
"

# Run seed (idempotent — upserts, safe to re-run)
npx prisma db seed 2>/dev/null || true

echo "=== DB setup complete ==="
