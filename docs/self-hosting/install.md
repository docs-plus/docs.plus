# Install

A numbered path from clone to a working site on one server, then how to check it worked. Read [Requirements](README.md) first and have every external service ready.

This page covers a production install. To run docs.plus locally instead, use `make dev-local` and see [CONTRIBUTING.md](../../CONTRIBUTING.md).

Every command runs from the repository root.

## 1. Clone

```bash
git clone https://github.com/docs-plus/docs.plus.git
cd docs.plus
```

## 2. Prepare Supabase

Create your project, then enable the `pg_cron` and `pgmq` extensions. Email and push do not work without them.

Apply the SQL by hand. There is no deploy pipeline for it.

- Run `packages/supabase/scripts/00-bootstrap.sql` first.
- Then run the remaining numbered files in name order.
- **Skip three files. They are not schema:** `idea.sql`, `cleanup-orphan-chat-media.sql`, and `30-seed-car-conversation.sql`.

Next step: keep a note of which file you reached. A partial apply leaves features silently missing rather than failing loudly.

Then set your redirect URLs in Supabase Auth, for both your application domain and your admin domain.

Finally, insert yourself as an admin, or the admin dashboard admits nobody:

```sql
insert into public.admin_users (user_id) values ('<YOUR_SUPABASE_USER_ID>');
```

Take `<YOUR_SUPABASE_USER_ID>` from the Supabase dashboard after you sign in once.

## 3. Write your environment file

```bash
cp .env.example .env.production
```

Then edit it. [Configuration](configuration.md) explains the groups. The values you cannot skip:

- `DATABASE_URL` — your PostgreSQL server.
- The Supabase URL and keys, both the server-side and the `NEXT_PUBLIC_` ones.
- The object-storage endpoint, region, bucket, and key pair.
- `PERSIST_TO_LOCAL_STORAGE=false`. The template ships `true`, and that breaks uploads across two replicas.
- `ACME_EMAIL` — your address, for Let's Encrypt. **This one is missing from the template.** Without it, certificate registration uses the maintainer's address.

One template value is wrong. `NEXT_PUBLIC_RESTAPI_URL` ends in `/api/v1`, and no such route exists. Use `/api`.

## 4. Point your domains at the server

Traefik answers the HTTP challenge, so ports 80 and 443 must be reachable from the internet before you start.

Then edit the five hard-coded hostname lines in `docker-compose.prod.yml`. Search for `Host(` — there are exactly five:

| Line | Currently                             | Serves                   |
| ---- | ------------------------------------- | ------------------------ |
| 220  | `prodback.docs.plus` and `/api`       | The REST API             |
| 226  | `prodback.docs.plus` and `/health`    | Health checks            |
| 322  | `prodback.docs.plus` and `/websocket` | The collaboration socket |
| 517  | `docs.plus` and two aliases           | The editor               |
| 593  | `admin.docs.plus`                     | The admin dashboard      |

Next step: replace each with your own domain. No environment variable covers these, so skipping this step means nothing routes.

## 5. Create the Docker network

```bash
docker network create docsplus-network
```

The compose file declares this network as external, and nothing in the compose file or the `Makefile` creates it. Only the CI workflow does. Skip this and `make up-prod` fails before any container starts.

## 6. Build the images

```bash
make build
```

This bakes every `NEXT_PUBLIC_` value into the webapp and admin bundles. Changing one later needs another build.

## 7. Run the database migration

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm migrate
```

Run this as its own step, before you start the stack.

The three backend services all set `RUN_MIGRATIONS: '0'`, and the one-shot `migrate` service has no ordering relationship with them — they depend on Redis only. So a plain start can bring the applications up against an unmigrated database.

## 8. Start

```bash
make up-prod
```

## 9. Verify

```bash
make status-prod
```

Then check each process answers. From the host:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec rest-api \
  bun -e "fetch('http://localhost:4000/health').then(r => console.log(r.status))"
```

Expect `200`. Repeat for the collaboration process on port `4001` and the worker on port `4002`.

The worker check is the one people skip. Its health body carries a `status` field, and only `healthy` means it is really draining the save queue.

Last, open your domain in a browser, create a document, type in it, reload, and confirm the text survived. That round trip is the only check that proves the whole chain works: socket, Redis, worker, and database together.

## Ports

Published to the host: `80`, `443`, and `127.0.0.1:8080` for the Traefik dashboard.

Everything else is internal to the Docker network.

| Port   | Process              |
| ------ | -------------------- |
| `3000` | webapp               |
| `3100` | admin dashboard      |
| `4000` | REST API             |
| `4001` | Collaboration socket |
| `4002` | Worker health        |
| `4003` | Internal listener    |

**Never route port 4003 through your proxy.** It carries service-role write endpoints, and only network isolation protects it.

**The Traefik dashboard on 8080 has no authentication.** It is bound to localhost, and that bind is the only thing protecting it. Next step: reach it over an SSH tunnel, and never change that bind to a public address.

## Things that silently do nothing

Each of these fails quietly. No error, and no log line that names the cause.

- A `NEXT_PUBLIC_` value changed after `make build`. It has no effect until you rebuild.
- `PUBLIC_RESTAPI_URL` unset. Word imports then report every image as dropped, and exports omit pictures.
- `PERSIST_TO_LOCAL_STORAGE=true` in production. Uploads land on one replica and vanish on redeploy.
- Redis unavailable. Rate limiting turns itself off and every request passes.
- A stopped worker. Documents look saved in the editor and never reach the database.

## Updating a value later

Compose gives your shell environment precedence over `--env-file`, and a running container keeps the value it started with.

So editing `.env.production` is not enough:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --force-recreate
```

Next step: use `--force-recreate` after any environment change, then verify with `make status-prod`.

## Where to go next

- [Configuration](configuration.md) — what each setting group does.
- [API overview](../api/README.md) — to call docs.plus from your own code.
