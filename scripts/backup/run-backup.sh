#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

fail() {
  echo "backup error: $1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command is unavailable: $1"
}

require_command docker
require_command gpg
require_command node
require_command sha256sum

[[ -n "${BACKUP_ENCRYPTION_KEY:-}" ]] || fail "BACKUP_ENCRYPTION_KEY is required"
[[ "${#BACKUP_ENCRYPTION_KEY}" -ge 32 ]] || fail "BACKUP_ENCRYPTION_KEY must have at least 32 characters"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK_ROOT="${BACKUP_WORK_ROOT:-${RUNNER_TEMP:-/tmp}/programing-evo-backup-work}"
OUTPUT_DIR="${BACKUP_ARTIFACT_DIR:-${RUNNER_TEMP:-/tmp}/programing-evo-backup-artifacts}"
RUN_ID="${BACKUP_RUN_ID:-local-$$}"
POSTGRES_IMAGE="${BACKUP_POSTGRES_IMAGE:-postgres:17-bookworm}"
TIMESTAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
BASE_NAME="backup-${TIMESTAMP}-${RUN_ID}"
mkdir -p "$WORK_ROOT" "$OUTPUT_DIR"
WORK_DIR="$(mktemp -d "$WORK_ROOT/run.XXXXXX")"
PLAIN_DUMP="$WORK_DIR/$BASE_NAME.dump"
DECRYPTED_DUMP="$WORK_DIR/$BASE_NAME.restore.dump"
ENCRYPTED_FILE="$OUTPUT_DIR/$BASE_NAME.dump.gpg"
CHECKSUM_FILE="$ENCRYPTED_FILE.sha256"
DB_URL_FILE="$WORK_DIR/source-db-url"

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT INT TERM

DB_URL_OUTPUT_FILE="$DB_URL_FILE" node "$SCRIPT_DIR/validate-db-url.mjs"
DB_URL="$(<"$DB_URL_FILE")"
rm -f "$DB_URL_FILE"

if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
  echo "::add-mask::$DB_URL"
fi

source_network_args=()
if [[ -n "${BACKUP_SOURCE_NETWORK:-}" ]]; then
  source_network_args+=(--network "$BACKUP_SOURCE_NETWORK")
fi

docker run --rm "$POSTGRES_IMAGE" pg_dump --version

docker run --rm \
  "${source_network_args[@]}" \
  --env DB_URL="$DB_URL" \
  --volume "$WORK_DIR:/backup" \
  "$POSTGRES_IMAGE" \
  sh -ceu 'pg_dump --dbname="$DB_URL" --format=custom --no-owner --no-privileges --file="/backup/'"$BASE_NAME"'.dump"'

[[ -s "$PLAIN_DUMP" ]] || fail "pg_dump did not create a non-empty custom dump"

printf '%s' "$BACKUP_ENCRYPTION_KEY" | gpg \
  --batch --yes --quiet --no-symkey-cache --pinentry-mode loopback \
  --passphrase-fd 0 --symmetric --cipher-algo AES256 \
  --output "$ENCRYPTED_FILE" "$PLAIN_DUMP"
[[ -s "$ENCRYPTED_FILE" ]] || fail "encryption did not create a non-empty artifact"

rm -f "$PLAIN_DUMP"
(
  cd "$OUTPUT_DIR"
  sha256sum "$(basename "$ENCRYPTED_FILE")" >"$(basename "$CHECKSUM_FILE")"
  sha256sum --check "$(basename "$CHECKSUM_FILE")" >/dev/null
)

printf '%s' "$BACKUP_ENCRYPTION_KEY" | gpg \
  --batch --yes --quiet --no-symkey-cache --pinentry-mode loopback \
  --passphrase-fd 0 --decrypt --output "$DECRYPTED_DUMP" "$ENCRYPTED_FILE"
[[ -s "$DECRYPTED_DUMP" ]] || fail "controlled decryption did not recreate the dump"

BACKUP_RUN_ID="$RUN_ID" "$SCRIPT_DIR/verify-restore.sh" "$DECRYPTED_DUMP"

if [[ -n "${GITHUB_ENV:-}" ]]; then
  {
    echo "BACKUP_TAG=$BASE_NAME"
    echo "BACKUP_FILE=$ENCRYPTED_FILE"
    echo "BACKUP_CHECKSUM_FILE=$CHECKSUM_FILE"
  } >>"$GITHUB_ENV"
fi

echo "encrypted backup and isolated restore: PASS"
