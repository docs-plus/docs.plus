# GitHub Relay

Receives GitHub repository webhooks, queues updates per channel in SQLite, and posts live Discord Components V2 cards.

Production ops paging stays on Telegram. This service sends only repository activity, accountability digests, and release cards to Discord.

## Architecture

- **Ingress:** `POST /webhook/github` verifies `X-Hub-Signature-256` and returns `202` in milliseconds.
- **State:** SQLite WAL stores webhook delivery IDs, per-channel FIFO queues, batch windows, star cooldowns, and `entity -> message_id` anchors.
- **Delivery:** One REST-only Discord Bot Token posts new cards, updates anchors with `PATCH`, and threads human updates via `message_reference`.
- **Digests:** An internal scheduler posts a weekday morning triage digest to `#triage` and a Friday shipped recap to `#github`.

## Discord Bot Setup

Create a Discord Application and generate a Bot Token. Turn off every Gateway intent, because this service makes HTTPS REST calls only.

Invite the bot to the docs.plus server with these four channel permissions in `#github`, `#triage`, and `#releases`:

1. `View Channel`
2. `Send Messages`
3. `Read Message History`
4. `Embed Links`

## Production Setup

1. Point DNS `A` record `webhooks.docs.plus` to the production host.
2. On the production host, create `/opt/projects/prod.docs.plus/.env.github-relay` from [`.env.example`](.env.example).
3. Fill `GITHUB_WEBHOOK_SECRET`, `DISCORD_BOT_TOKEN`, `DISCORD_GITHUB_CHANNEL_ID`, `DISCORD_TRIAGE_CHANNEL_ID`, and `DISCORD_RELEASES_CHANNEL_ID`.
4. Optionally add GitHub-to-Discord user IDs in `discord-users.json` (`apps/github-relay/discord-users.json`) for opt-in accountability pings.
5. Add `GITHUB_TOKEN` (fine-grained read-only) so daily digests include Discussions and pushes over 20 commits expand via compare API.
6. In GitHub Settings → Actions → Runner groups → `prod.docs.plus`, allow `github-relay.docs.plus.yml` from `main`.
7. Run the workflow `CI/CD GitHub Relay` (`action=setup`).

## GitHub Webhook Setup

In GitHub Settings → Webhooks → Add webhook:

- **Payload URL:** `https://webhooks.docs.plus/webhook/github`
- **Content type:** `application/json`
- **Secret:** Same value as `GITHUB_WEBHOOK_SECRET`
- **Events:** Select `Pushes`, `Pull requests`, `Pull request reviews`, `Issues`, `Issue comments`, `Discussions`, `Discussion comments`, `Releases`, `Stars`, and `Workflow runs`.

## Cutover and Rollback

- **Cutover:** Watch `https://webhooks.docs.plus/webhook/github` deliver clean cards, then set repository variable `DISCORD_RELAY_ACTIVE=true`. That disables the three legacy Discord workflows without deleting them.
- **Rollback:** Set `DISCORD_RELAY_ACTIVE=false` and disable the GitHub repository webhook. The legacy Discord workflows resume on the next event.

## Local Test and Manual Digest

```bash
bun run --filter @docs.plus/github-relay test
bun run --filter @docs.plus/github-relay typecheck
```

Trigger a manual digest from the production host (never exposed on Traefik):

```bash
docker compose -f docker-compose.github-relay.yml exec -T github-relay \
  bun -e "fetch('http://127.0.0.1:4050/internal/digest',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+process.env.RELAY_ADMIN_TOKEN},body:JSON.stringify({kind:'daily',force:true})}).then(async r=>console.log(r.status,await r.text()))"
```
