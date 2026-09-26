# Backend runbook

What to do when one of five backend alerts fires. It covers document persistence, Redis, the dead-letter queue, and the collaboration container's memory. It does not cover the edge, Supabase, the webapp, or any other alert.

Each section below matches one Grafana alert. That alert links here through its `runbook_url` annotation.

## Before you start

Every command runs on the server, in the directory that holds `docker-compose.prod.yml`. Set this shorthand first. The rest of this page uses `dc`.

```bash
alias dc='docker compose -p docsplus -f docker-compose.prod.yml --env-file .env.production'
```

`hocuspocus-server` and `hocuspocus-worker` each run two replicas. `exec` needs `--index`, and the numbers are not always 1 and 2. List them before you exec into one.

```bash
dc ps --format "{{.Service}} {{.Name}}"
```

`logs` and `restart` need no index. They cover both replicas.

## Document saves rejected

Grafana alert: `Document saves rejected (writes dropped)`. Severity critical. It fires on the first rejection, with no tolerance band.

**The loss already happened.** One room lost every edit since its last successful save. Nothing recovers those edits. Every other room kept its own.

The alert carries `reason`, not the document name. The logs name the document. Commands below use the `dc` alias from [Before you start](#before-you-start).

1. Read `reason` on the alert. `version-collision` means two writers raced for the same version number twice and the flush was dropped. `fallback-save-failed` means the direct database write failed too.
2. Name the affected documents.

   ```bash
   dc logs --since 30m hocuspocus-server | grep -E 'Fallback save (failed|lost)'
   ```

   `Fallback save failed - document may be lost` is `fallback-save-failed`. `Fallback save lost the version race twice - flush dropped` is `version-collision`.

3. Check what else fired in the same 10-minute window. `Postgres down`, `Postgres connection saturation`, `Redis near maxmemory` and `store-documents queue backlog` are the usual causes. Fix the cause; the rejection is a symptom.
4. Tell the owner of each named document. The version history holds their last successful save, so they can see how far back the loss goes.

**Mechanism.** The store hook never throws. A throw would leave Hocuspocus's debouncer holding a rejected promise for the process lifetime, which stops saves for every room and blocks shutdown. The hook therefore counts `document_store_rejections_total`, logs, reports to Sentry, and returns. That counter is the only remaining trace of the dropped write, which is why this alert exists.

## Edits arriving but no document saved

Grafana alert: `Edits arriving but no document saved`. Severity critical. It uses a 10-minute window plus `for: 10m`, so it fires after 20 minutes in which edits reached `hocuspocus-server` and no save finished.

The rule counts edits, not open sockets, so readers who never type cannot fire it. It is fleet-wide on purpose. Both replicas count an edit relayed through Redis, but only the replica that received it saves it.

Commands below use the `dc` alias from [Before you start](#before-you-start).

1. Check Redis first. A Redis outage pauses every save, and no save counter moves. `Redis down` fires in the same window when this is the cause. Go to [Redis down](#redis-down).
2. Confirm edits are still arriving. `sum(rate(ydoc_update_bytes_count{job="hocuspocus-server"}[10m]))` must be above zero. If it is zero, the stall is over and the alert clears on its own.
3. Capture the logs of both replicas, and look for `Caught error during storeDocumentHooks`.

   ```bash
   dc logs --since 1h hocuspocus-server > /tmp/hocuspocus-persist-stall.log
   ```

4. Restart only as a last resort, and only when Redis is healthy and saves stay at zero for another 10 minutes. A restart drops every live connection on that replica. `dc restart hocuspocus-server` restarts both replicas at once, so restart one container at a time instead. Names come from `dc ps`.

   ```bash
   docker restart docsplus-hocuspocus-server-<n>
   ```

5. Confirm saves resumed. `sum(rate(document_persist_duration_seconds_count{job="hocuspocus-server"}[10m]))` must go above zero.

## Redis down

Grafana alert: `Redis down (redis_up==0)`. Severity critical, after 1 minute.

**Saves pause silently while Redis is down.** The store lock fails after about 43 seconds with an empty error, so no save counter and no rejection counter moves. This alert is the only signal. Edits stay in the loaded rooms. They save on the next edit or when the room closes, once Redis is back. A room that closes during the outage loses the edits it had not saved yet.

1. Check the container.

   ```bash
   dc ps -a redis
   dc logs --since 30m redis
   ```

2. Start it if it stopped. Redis keeps its data in an append-only file, so the queues survive a restart.

   ```bash
   dc up -d redis
   ```

3. Confirm saves resumed, as in step 5 of [Edits arriving but no document saved](#edits-arriving-but-no-document-saved).

## Dead-letter queue not empty

Grafana alert: `Dead-letter queue not empty`. Severity warning, after 5 minutes. The alert names the queue.

For `email-dlq` and `push-dlq`, inspect `GET /api/admin/audit/notifications/dlq` and stop here. The rest of this section is `store-documents-dlq` only, which holds document saves that exhausted their retries. Commands below use the `dc` alias and the replica index `<n>` from [Before you start](#before-you-start).

**Check the worker before you drain.** `--apply` puts the payload back behind a Redis claim-check key with a one-hour TTL. If the store worker is not consuming, that hour expires and the bytes are gone. The dead-letter entry was holding those same bytes with no TTL, so draining into a stalled worker destroys them.

1. Confirm the worker is consuming.

   ```bash
   dc exec redis redis-cli CLIENT LIST | grep -c bzpopmin
   ```

   Expect three blocking clients per worker replica — document, email and push. A count below that means a parked fetch loop. Restart `hocuspocus-worker` and re-check before you go on.

2. Run the drain as a dry run. It is dry by default.

   ```bash
   dc exec -w /app/apps/hocuspocus.server --index <n> hocuspocus-worker \
     bun scripts/drain-store-dlq.ts
   ```

3. Read the table. Each entry gets one disposition. `replay` re-enqueues it through the normal save path. `discard` drops it, because the payload is gone or the entry is older than the delete-retention window. `skip-trashed` drops it, because the document is in the trash.

   A `head` marked `*` means a newer version landed after the entry failed. The replay then likely mints a duplicate version, and a duplicate carrying a commit message is exempt from the autosave sweep forever. A `head` of `none` means the replay recreates the document and re-sends its "document created" email.

4. Apply, once the worker check passed and you have read the dispositions.

   ```bash
   dc exec -w /app/apps/hocuspocus.server --index <n> hocuspocus-worker \
     bun scripts/drain-store-dlq.ts --apply
   ```

   Every disposition ends in a removal, so `--apply` empties the queue, including the entries it discards. This is the destructive step.

5. Confirm the depth returns to zero and the alert clears.

**Mechanism.** The drain re-enqueues, it never inserts. The worker's locked merge stays the only code that writes a version row. A direct insert would replace a newer head with an older snapshot and re-store the deleted text the merge path exists to drop.

## WS container out of memory

Grafana alert: `Container memory near limit (OOM risk)`. Severity critical, above 90% of the cgroup limit for 5 minutes. The alert names the container. This section covers a `hocuspocus-server` container; the same alert fires for any other container, and those are not this page.

`Container crash loop (restarts increasing)` is the same failure one step later. An OOM kill shows as exit code 137.

**The lever is room count, not a setting.** A loaded room costs 16.5–17x its stored snapshot in heap, and about 23x in RSS. The cgroup kills on RSS, so use that slope. The limit is 1024M per replica, and the process itself floors at roughly 130–154 MB. The ceiling is therefore document size times the number of rooms loaded at once.

**Adding replicas does not lower this.** Every replica serving one connection to a document holds its own complete copy of it. A hot room is therefore loaded on each of them. Measured 2026-09-05. Replicas raise connection capacity, never room capacity.

Commands below use the `dc` alias from [Before you start](#before-you-start).

1. Check whether it already died.

   ```bash
   dc ps -a --format "{{.Name}} {{.Status}}"
   ```

   Exit code 137 is an OOM kill.

2. Restart the named service to shed loaded rooms.

   ```bash
   dc restart hocuspocus-server
   ```

   Rooms reload from Postgres as clients reconnect, so this is a reset, not a fix.

3. Watch whether memory climbs back within the hour. If it does, the load is real. Raise the `memory` limit in `docker-compose.prod.yml`, which needs a deploy.

   **Do not add replicas to fix this.** Room memory multiplies across replicas rather than dividing, so a new replica loads the same hot room again. Add replicas only when `ws_active_connections` is the number that is high.

   One large document can fill a replica on its own. At the measured RSS slope, a 5 MB stored snapshot costs about 118 MB loaded.

4. If memory stays high while `ws_active_connections` falls, a room is wedged rather than busy. Hocuspocus unloads a room as soon as its last connection closes, so memory should follow connections down. Go to [Edits arriving but no document saved](#edits-arriving-but-no-document-saved).
5. Check `stateless_relay_dropped_total`. A burst means a client is pushing oversized frames at the relay. The 64 KiB budget already drops them, so this is a probe and not the cause, but it is worth reporting.
