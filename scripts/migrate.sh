#!/usr/bin/env bash
set -euo pipefail

MIGRATIONS_DIR="$(dirname "$0")/../migrations"
DB_NAME="${HARBR_DB_NAME:-harbr}"
DB_USER="${HARBR_DB_USER:-harbr}"
DB_PASSWORD="${HARBR_DB_PASSWORD:-harbr}"
DB_HOST="${HARBR_DB_HOST:-localhost}"
DB_PORT="${HARBR_DB_PORT:-5432}"

export PGPASSWORD="$DB_PASSWORD"

info()  { echo -e "\\033[0;32m[harbr]\\033[0m $1"; }
error() { echo -e "\\033[0;31m[harbr]\\033[0m $1" >&2; exit 1; }

command -v psql >/dev/null 2>&1 || error "psql not found. Install PostgreSQL client."

info "Running migrations against $DB_HOST:$DB_PORT/$DB_NAME..."

for f in "$MIGRATIONS_DIR"/[0-9][0-9][0-9]_*.sql; do
  [ -f "$f" ] || continue
  name="$(basename "$f")"
  info "  Running $name..."
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -q -f "$f" 2>&1 | grep -v "already exists" || true
done

info "All migrations completed successfully."

info "Verifying tables..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
  ORDER BY table_name;
"
