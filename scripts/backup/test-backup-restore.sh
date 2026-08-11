#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_ID="${GITHUB_RUN_ID:-$$}-${RANDOM}"
NETWORK="evo-backup-test-$TEST_ID"
SOURCE_CONTAINER="evo-backup-source-$TEST_ID"
TEST_ROOT="$(mktemp -d)"
SOURCE_PASSWORD="synthetic-source-password"
ENCRYPTION_KEY="synthetic-encryption-key-for-ci-only-1234567890"

cleanup() {
  docker rm -f "$SOURCE_CONTAINER" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
  rm -rf "$TEST_ROOT"
}
trap cleanup EXIT INT TERM

docker network create "$NETWORK" >/dev/null
docker run --detach --rm \
  --name "$SOURCE_CONTAINER" \
  --network "$NETWORK" \
  --env POSTGRES_PASSWORD="$SOURCE_PASSWORD" \
  postgres:17-bookworm >/dev/null

ready=0
for ((attempt = 0; attempt < 60; attempt += 1)); do
  if docker exec --env PGPASSWORD="$SOURCE_PASSWORD" "$SOURCE_CONTAINER" \
    pg_isready --quiet --username postgres --dbname postgres; then
    ready=1
    break
  fi
  sleep 1
done
[[ "$ready" -eq 1 ]] || { echo "synthetic source did not become ready" >&2; exit 1; }

docker exec --interactive --env PGPASSWORD="$SOURCE_PASSWORD" "$SOURCE_CONTAINER" \
  psql --no-psqlrc --quiet --set ON_ERROR_STOP=1 --username postgres --dbname postgres <<'SQL'
create table public.published_weeks (
  id uuid primary key,
  titulo text not null,
  data jsonb not null
);
create table public.coach_sessions (
  id uuid primary key,
  week_id uuid not null references public.published_weeks(id)
);
create table public.coach_messages (
  id uuid primary key,
  session_id uuid not null references public.coach_sessions(id)
);
create table public.coach_session_feedback (
  id uuid primary key,
  week_id uuid not null references public.published_weeks(id)
);
create function public.save_published_week_draft_v2() returns void language sql as 'select';
create function public.publish_published_week_draft_v2() returns void language sql as 'select';
create function public.save_and_publish_published_week_v2() returns void language sql as 'select';
insert into public.published_weeks values (
  '00000000-0000-0000-0000-000000000001',
  'Synthetic week',
  '{"synthetic":true}'::jsonb
);
insert into public.coach_sessions values (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001'
);
insert into public.coach_messages values (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000002'
);
insert into public.coach_session_feedback values (
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000001'
);
SQL

env \
  SUPABASE_DB_URL="postgresql://postgres:$SOURCE_PASSWORD@$SOURCE_CONTAINER:5432/postgres" \
  SUPABASE_PRODUCTION_PROJECT_REF="synthetic-ref" \
  BACKUP_ALLOW_LOCAL_TEST_URL=1 \
  BACKUP_SOURCE_NETWORK="$NETWORK" \
  BACKUP_ENCRYPTION_KEY="$ENCRYPTION_KEY" \
  BACKUP_WORK_ROOT="$TEST_ROOT/work" \
  BACKUP_ARTIFACT_DIR="$TEST_ROOT/output" \
  BACKUP_RUN_ID="$TEST_ID" \
  BACKUP_REQUIRED_TABLES="public.published_weeks public.coach_sessions public.coach_messages public.coach_session_feedback" \
  BACKUP_REQUIRED_FUNCTIONS="save_published_week_draft_v2 publish_published_week_draft_v2 save_and_publish_published_week_v2" \
  "$SCRIPT_DIR/run-backup.sh"

encrypted_files=("$TEST_ROOT"/output/*.dump.gpg)
checksum_files=("$TEST_ROOT"/output/*.dump.gpg.sha256)
[[ "${#encrypted_files[@]}" -eq 1 && -s "${encrypted_files[0]}" ]]
[[ "${#checksum_files[@]}" -eq 1 && -s "${checksum_files[0]}" ]]
if find "$TEST_ROOT/work" -type f -name '*.dump' -print -quit | grep -q .; then
  echo "a plaintext dump remained after the backup test" >&2
  exit 1
fi

if BACKUP_RUN_ID="bad-restore-$TEST_ID" "$SCRIPT_DIR/verify-restore.sh" "${checksum_files[0]}"; then
  echo "a corrupt/non-dump restore unexpectedly passed" >&2
  exit 1
fi

if env -u BACKUP_ENCRYPTION_KEY \
  SUPABASE_DB_URL="postgresql://postgres:$SOURCE_PASSWORD@$SOURCE_CONTAINER:5432/postgres" \
  SUPABASE_PRODUCTION_PROJECT_REF="synthetic-ref" \
  BACKUP_ALLOW_LOCAL_TEST_URL=1 \
  "$SCRIPT_DIR/run-backup.sh"; then
  echo "backup unexpectedly ran without an encryption key" >&2
  exit 1
fi

echo "synthetic backup and restore tests: PASS"
