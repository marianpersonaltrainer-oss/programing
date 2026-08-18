#!/usr/bin/env bash
set -Eeuo pipefail

fail() {
  echo "restore verification error: $1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command is unavailable: $1"
}

require_command docker
require_command openssl

DUMP_FILE="${1:-}"
[[ -n "$DUMP_FILE" && -f "$DUMP_FILE" ]] || fail "a readable custom dump path is required"

RESTORE_IMAGE="${BACKUP_RESTORE_IMAGE:-${BACKUP_POSTGRES_IMAGE:-postgres:17-bookworm}}"
RESTORE_DB="evo_restore"
RESTORE_PASSWORD="$(openssl rand -hex 32)"
RESTORE_CONTAINER="evo-backup-restore-${BACKUP_RUN_ID:-$$}"
RESTORE_CONTAINER="${RESTORE_CONTAINER//[^a-zA-Z0-9_.-]/-}"

cleanup() {
  docker rm -f "$RESTORE_CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker run --detach --rm \
  --name "$RESTORE_CONTAINER" \
  --network none \
  --env POSTGRES_PASSWORD="$RESTORE_PASSWORD" \
  --env POSTGRES_DB="$RESTORE_DB" \
  "$RESTORE_IMAGE" >/dev/null

ready=0
for ((attempt = 0; attempt < 60; attempt += 1)); do
  if docker exec \
    --env PGPASSWORD="$RESTORE_PASSWORD" \
    "$RESTORE_CONTAINER" \
    pg_isready --quiet --username postgres --dbname "$RESTORE_DB"; then
    ready=1
    break
  fi
  sleep 1
done
[[ "$ready" -eq 1 ]] || fail "the isolated PostgreSQL container did not become ready"

if ! docker exec --interactive \
  --env PGPASSWORD="$RESTORE_PASSWORD" \
  "$RESTORE_CONTAINER" \
  pg_restore \
    --exit-on-error \
    --no-owner \
    --no-privileges \
    --username postgres \
    --dbname "$RESTORE_DB" <"$DUMP_FILE"; then
  fail "pg_restore failed"
fi

psql_scalar() {
  docker exec \
    --env PGPASSWORD="$RESTORE_PASSWORD" \
    "$RESTORE_CONTAINER" \
    psql --no-psqlrc --tuples-only --no-align --quiet \
      --username postgres --dbname "$RESTORE_DB" --command "$1"
}

validate_identifier() {
  [[ "$1" =~ ^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$ ]] || fail "invalid relation identifier in validation configuration"
}

read -r -a required_tables <<<"${BACKUP_REQUIRED_TABLES:-public.published_weeks}"
for relation in "${required_tables[@]}"; do
  validate_identifier "$relation"
  [[ "$(psql_scalar "select to_regclass('$relation') is not null;")" == "t" ]] || \
    fail "required relation is missing: $relation"
done

read -r -a required_functions <<<"${BACKUP_REQUIRED_FUNCTIONS:-}"
for function_name in "${required_functions[@]}"; do
  [[ "$function_name" =~ ^[a-z_][a-z0-9_]*$ ]] || fail "invalid function name in validation configuration"
  function_count="$(psql_scalar "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = '$function_name';")"
  [[ "$function_count" =~ ^[1-9][0-9]*$ ]] || fail "required function is missing: $function_name"
done

unvalidated_fks="$(psql_scalar "select count(*) from pg_constraint where contype = 'f' and not convalidated;")"
[[ "$unvalidated_fks" == "0" ]] || fail "the restore contains unvalidated foreign keys"

week_table="${BACKUP_WEEK_TABLE:-public.published_weeks}"
validate_identifier "$week_table"
week_count="$(psql_scalar "select count(*) from $week_table;")"
[[ "$week_count" =~ ^[1-9][0-9]*$ ]] || fail "the restored database has no readable published week"

echo "isolated restore verification: PASS"
