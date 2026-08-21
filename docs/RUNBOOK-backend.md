# Backend runbook

What to do when one of four backend alerts fires. It covers document persistence, the dead-letter queue, and the collaboration container's memory. It does not cover the edge, Supabase, the webapp, or any other alert.

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

## Persistence stopped while users are connected

Grafana alert: `Document persistence stopped while users are connected`. Severity critical. It uses a 10-minute window plus `for: 10m`, so it fires after 20 minutes of open sockets with no save.

**This does not self-heal. Restart `hocuspocus-server`.** Waiting is the wrong move. A rejected store promise wedges the debouncer for the process lifetime, and the wedged room never unloads either.

Commands below use the `dc` alias from [Before you start](#before-you-start).

1. Rule out a quiet room first. The alert asks whether anything saved, not whether anyone typed, so a public document with six idle readers fires it. `sum(rate(ydoc_update_bytes_count[10m]))` counts edits reaching the server. Zero there means nobody is typing, and the restart would drop live connections for nothing. Above zero means edits are arriving and not persisting, which is the real stall. Go on.
2. Capture the logs. They are the only explanation, and the restart is what you do next.

   ```bash
   dc logs --since 1h hocuspocus-server > /tmp/hocuspocus-persist-stall.log
   ```

3. Restart the service.

   ```bash
   dc restart hocuspocus-server
   ```

   Rooms reload from Postgres when clients reconnect. Any room that was wedged had already stopped saving, so the restart costs it nothing new. A healthy room loses at most its last debounce window.

4. Confirm saves resumed. `sum(rate(document_persist_duration_seconds_count[10m]))` must go above zero, and the alert clears on the next evaluation.
5. Read the captured log for the throw that wedged the hook. Report it — the hook is written so that this cannot happen, so a real occurrence is a code defect.

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

**The lever is room count, not a setting.** A loaded room costs 16.5–17x its stored snapshot in heap. The limit is 1024M per replica. The ceiling is therefore document size times the number of rooms loaded at once.

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

3. Watch whether memory climbs back within the hour. If it does, the load is real. The options are more replicas or a higher `memory` limit in `docker-compose.prod.yml`, and both need a deploy.
4. If memory stays high while `ws_active_connections` falls, a room is wedged rather than busy. Hocuspocus unloads a room as soon as its last connection closes, so memory should follow connections down. Go to [Persistence stopped while users are connected](#persistence-stopped-while-users-are-connected).
5. Check `stateless_relay_dropped_total`. A burst means a client is pushing oversized frames at the relay. The 64 KiB budget already drops them, so this is a probe and not the cause, but it is worth reporting.
