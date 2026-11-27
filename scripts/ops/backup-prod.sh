#!/usr/bin/env bash
# Streams one production store, age-encrypted, to the off-host backup bucket.
# Nothing is staged on the host disk. Usage: backup-prod.sh <store>
set -euo pipefail
STORE="${1:?usage: backup-prod.sh <store>}"
E=/opt/docsplus-backup/.env.backup
while IFS='=' read -r k v || [ -n "$k" ]; do
  v="${v%$'\r'}"
  case "$v" in
    \"*\") v="${v#\"}"; v="${v%\"}" ;;
    \'*\') v="${v#\'}"; v="${v%\'}" ;;
  esac
  case "$k" in
    AGE_RECIPIENT) AGE_RECIPIENT="$v" ;;
    BUCKET) BUCKET="$v" ;;
    MEDIA_BUCKET) MEDIA_BUCKET="$v" ;;
  esac
done < "$E"
TS=$(date -u +%Y%m%dT%H%MZ)
START=$(date +%s)
RCLONE=(docker run --rm -i --env-file "$E" rclone/rclone:1.75.2)
PG=(docker run --rm --env-file "$E" postgres:18.6-alpine)
OBJ=""
up() { "${RCLONE[@]}" rcat "backup:${BUCKET}/$1"; }
enc() { age -r "$AGE_RECIPIENT"; }

# shellcheck disable=SC2016 # the database URLs expand inside the container, not on the host
case "$STORE" in
  db) OBJ="db/db-$TS.dump.age"; "${PG[@]}" sh -c 'pg_dump --format=custom --no-owner "$PG_URL"' | enc | up "$OBJ" ;;
  supabase-db) OBJ="supabase-db/supabase-db-$TS.dump.age"; "${PG[@]}" sh -c 'pg_dump --format=custom --no-owner "$SUPABASE_DB_URL"' | enc | up "$OBJ" ;;
  redis)
    OBJ="redis/redis-$TS.rdb.age"
    USED=$(docker exec docsplus-redis redis-cli INFO memory | sed -n 's/^used_memory:\([0-9]*\).*/\1/p')
    if ! { [[ "$USED" =~ ^[0-9]+$ ]] && [ "$USED" -gt 0 ]; }; then
      echo "redis: failed to read used_memory (got '$USED')" >&2
      exit 1
    fi
    AVAIL=$(( $(awk '/^MemAvailable:/ {print $2}' /proc/meminfo) * 1024 ))
    FREE=$(( $(df -Pk / | awk 'NR == 2 {print $4}') * 1024 ))
    if [ "$AVAIL" -lt $(( 2 * USED )) ] || [ "$FREE" -lt $(( 3 * USED )) ]; then echo "redis: skipped, low memory or disk" >&2; exit 3; fi
    docker exec docsplus-redis redis-cli --rdb - | enc | up "$OBJ" ;;
  certs) OBJ="certs/certs-$TS.tgz.age"; docker run --rm -v docsplus_traefik-certs:/letsencrypt:ro alpine:3.22 tar czf - -C /letsencrypt . | enc | up "$OBJ" ;;
  glitchtip) OBJ="glitchtip/glitchtip-$TS.dump.age"; docker exec docsplus-glitchtip-postgres pg_dump -U glitchtip -Fc glitchtip | enc | up "$OBJ" ;;
  uptime-kuma)
    OBJ="uptime-kuma/uptime-kuma-$TS.db.gz.age"
    docker exec docsplus-uptime-kuma sh -c 'tmp=$(mktemp /tmp/kuma-backup.XXXXXX.db) && trap "rm -f \"$tmp\"" EXIT && sqlite3 /app/data/kuma.db ".timeout 10000" ".backup \"$tmp\"" && gzip -c "$tmp"' | enc | up "$OBJ" ;;
  media) MIRROR=media; "${RCLONE[@]}" sync "media:${MEDIA_BUCKET}" "backup:${BUCKET}/media/" --backup-dir "backup:${BUCKET}/media-deleted/$TS" --max-delete 50 ;;
  supabase-storage) MIRROR=supabase-storage; "${RCLONE[@]}" sync sbstore: "backup:${BUCKET}/supabase-storage/" --backup-dir "backup:${BUCKET}/supabase-storage-deleted/$TS" --max-delete 50 ;;
  *) echo "unknown store: $STORE" >&2; exit 2 ;;
esac

BYTES=""
OBJECTS=""
if [ -n "$OBJ" ]; then
  BYTES=$("${RCLONE[@]}" size --json "backup:${BUCKET}/$OBJ" | sed -E 's/.*"bytes":([0-9]+).*/\1/')
fi
if [ -n "${MIRROR:-}" ]; then
  OBJECTS=$("${RCLONE[@]}" size --json "backup:${BUCKET}/$MIRROR/" | sed -E 's/.*"count":([0-9]+).*/\1/')
fi
D=/var/lib/node_exporter/textfile
mkdir -p "$D"
{
  printf 'backup_last_success_timestamp_seconds{store="%s"} %s\n' "$STORE" "$(date +%s)"
  printf 'backup_last_duration_seconds{store="%s"} %s\n' "$STORE" "$(( $(date +%s) - START ))"
  if [ -n "$BYTES" ]; then printf 'backup_last_bytes{store="%s"} %s\n' "$STORE" "$BYTES"; fi
  if [ -n "$OBJECTS" ]; then printf 'backup_last_objects{store="%s"} %s\n' "$STORE" "$OBJECTS"; fi
} > "$D/backup_$STORE.prom.tmp"
chmod 0644 "$D/backup_$STORE.prom.tmp" && mv "$D/backup_$STORE.prom.tmp" "$D/backup_$STORE.prom"
