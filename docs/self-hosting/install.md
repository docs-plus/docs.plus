# Install

A numbered path from clone to a working site on one server, then how to check it worked and how to upgrade. Read [Requirements](README.md) first and have every external service ready.

This page covers a production install. To run docs.plus locally instead, use `make dev-local` and see [CONTRIBUTING.md](../../CONTRIBUTING.md).

## 1. Clone

From the folder where you keep your projects:

```bash
git clone https://github.com/docs-plus/docs.plus.git
cd docs.plus
```

The clone starts on `main`, which can hold changes that no release has yet. Install from the newest release tag instead. At the time of writing, that tag is `v2.1.0`.

At the root of the clone, list the tags, newest first, and check out the newest tag:

```bash
git tag --list 'v*' --sort=-v:refname
git checkout <TAG>
```

`<TAG>` is the first tag in that list without a hyphen. A tag with a hyphen, such as `v2.0.0-alpha.103`, is a pre-release. Confirm the tag in [CHANGELOG.md](../../CHANGELOG.md) or on [GitHub Releases](https://github.com/docs-plus/docs.plus/releases).

Each release ships its own copy of this page at `docs/self-hosting/install.md`. After the checkout, follow the copy in your clone. Keep a note of the tag. The upgrade calls it `<OLD_TAG>`.

To run `main` on purpose, stay on it and record the commit. At the root of the clone:

```bash
git rev-parse HEAD
```

Keep a note of that commit. The upgrade uses it as `<OLD_TAG>`. Also keep your own list of the Supabase migrations you applied. Upgrade item 3 checks against that list.

Every later step runs at the root of this clone, unless the step names another place.

## 2. Prepare Supabase

Create your project, then enable the `pg_cron` and `pgmq` extensions. Email and push do not work without them.

Apply the SQL by hand in the Supabase SQL editor. There is no deploy pipeline for it.

- Run `packages/supabase/scripts/00-bootstrap.sql` first.
- Then run the remaining numbered files in name order.
- **Skip three files. They are not schema:** `idea.sql`, `cleanup-orphan-chat-media.sql`, and `30-seed-car-conversation.sql`.

Next step: keep a note of which file you reached. A partial apply leaves features silently missing rather than failing loudly.

Then, in the Supabase dashboard, open **Authentication > URL Configuration**:

- Set **Site URL** to `https://<APP_HOST>`. The sign-in mail templates use this value for `{{ .SiteURL }}`. Supabase also accepts a sign-in return to any page on that host.
- Under **Redirect URLs**, add the exact entry `https://<ADMIN_HOST>/`. Admin login returns to its own origin plus `/`.

`<APP_HOST>` and `<ADMIN_HOST>` are the hosts that [step 4](#4-point-your-domains-at-the-server) names.

Leave sign-in mail and Google sign-in for now. The Google setup ends with a rebuild and a container recreate, so you finish both after step 8, in [Finish sign-in](#finish-sign-in).

## 3. Write your environment file

```bash
cp .env.example .env.production
```

Then edit it. [Configuration](configuration.md) explains the groups. The values you cannot skip:

- `DATABASE_URL` — your PostgreSQL server.
- The Supabase URL and keys, both the server-side and the `NEXT_PUBLIC_` ones.
- The object-storage endpoint, region, bucket, and key pair.
- `PERSIST_TO_LOCAL_STORAGE=false`. See [Template values to fix before you deploy](configuration.md#template-values-to-fix-before-you-deploy).

A Let's Encrypt email is optional. Traefik reads it from `traefik.yml`, not from `.env.production`. See [Choose where Traefik reads its config](configuration.md#choose-where-traefik-reads-its-config).

The two REST URLs, `NEXT_PUBLIC_RESTAPI_URL` and `PUBLIC_RESTAPI_URL`, take different forms, and each is defined at its link: [build values](configuration.md#webapp-and-admin-build-values) and [Public origin](../../apps/hocuspocus.server/ENV.md#public-origin).

### Values that must name your host

The template points every URL at `localhost`. Replace each of these with your own host.

| Value                      | Kind    | Defined in                                                                 |
| -------------------------- | ------- | -------------------------------------------------------------------------- |
| `NEXT_PUBLIC_PROVIDER_URL` | Build   | [Configuration](configuration.md#webapp-and-admin-build-values)            |
| `NEXT_PUBLIC_RESTAPI_URL`  | Build   | [Configuration](configuration.md#webapp-and-admin-build-values)            |
| `NEXT_PUBLIC_APP_URL`      | Build   | [Configuration](configuration.md#webapp-and-admin-build-values)            |
| `NEXT_PUBLIC_API_URL`      | Build   | [Configuration](configuration.md#webapp-and-admin-build-values)            |
| `PUBLIC_RESTAPI_URL`       | Runtime | [ENV.md, Public origin](../../apps/hocuspocus.server/ENV.md#public-origin) |
| `ALLOWED_ORIGINS`          | Runtime | [ENV.md, Security](../../apps/hocuspocus.server/ENV.md#security)           |
| `APP_URL`                  | Runtime | [ENV.md, Email](../../apps/hocuspocus.server/ENV.md#email)                 |
| `EMAIL_UNSUBSCRIBE_SECRET` | Runtime | [ENV.md, Email](../../apps/hocuspocus.server/ENV.md#email)                 |

`ALLOWED_ORIGINS` must list two origins, `https://<APP_HOST>` and `https://<ADMIN_HOST>`. The editor and the admin dashboard both call `<API_HOST>` from the browser. [ENV.md, Security](../../apps/hocuspocus.server/ENV.md#security) gives the format.

`make build` bakes the four build values into the bundles, so changing one afterwards needs another build.

Miss one and nothing complains. The site still starts, and the missed value points at `localhost` or at the docs.plus servers. Each link above defines its value.

`EMAIL_UNSUBSCRIBE_SECRET` fails the same quiet way. Unset, every email footer still shows an Unsubscribe link, and that link is rejected when a reader clicks it. [ENV.md, Email](../../apps/hocuspocus.server/ENV.md#email) says how to make one.

App email (invitations, digests, notifications) is optional. Sign-in mail is separate. Supabase sends it, and [Finish sign-in](#finish-sign-in) covers it. Leave `EMAIL_PROVIDER` and every provider key blank, and app email is `off`. If you set `EMAIL_PROVIDER`, also set `EMAIL_FROM`, `EMAIL_UNSUBSCRIBE_SECRET` and `PUBLIC_RESTAPI_URL`. [Email in 5 minutes](configuration.md#email-in-5-minutes) has the steps.

Next step: set all of them before `make build`. The Traefik host rules are a separate job, and step 4 covers them.

## 4. Point your domains at the server

You need three hosts. The editor host is `<APP_HOST>`. The backend host is `<API_HOST>`, which serves the REST API and the collaboration socket. The admin host is `<ADMIN_HOST>`.

Traefik answers the HTTP challenge, so ports 80 and 443 must be reachable from the internet before you start.

Then edit the hard-coded hostname lines in `docker-compose.prod.yml`. Search for `Host(`. There are five in the compose file:

| Line | Currently                             | Serves                   | Replace with   |
| ---- | ------------------------------------- | ------------------------ | -------------- |
| 224  | `prodback.docs.plus` and `/api`       | The REST API             | `<API_HOST>`   |
| 230  | `prodback.docs.plus` and `/health`    | Health checks            | `<API_HOST>`   |
| 334  | `prodback.docs.plus` and `/websocket` | The collaboration socket | `<API_HOST>`   |
| 539  | `docs.plus` and two aliases           | The editor               | `<APP_HOST>`   |
| 615  | `admin.docs.plus`                     | The admin dashboard      | `<ADMIN_HOST>` |

On line 539, replace the whole rule with one ``Host(`<APP_HOST>`)``, and delete the `new.docs.plus` and `www.new.docs.plus` aliases. Traefik asks for one certificate that covers every host in a rule, so a host you do not own makes that request fail.

No environment variable covers these, so skipping this step means nothing routes.

The Traefik folder also names docs.plus hosts. `scripts/traefik/dynamic/tiny.yml` routes two docs.plus test hosts, `tiny.docs.plus` and `ws.tiny.docs.plus`. With the default folder, your Traefik asks Let's Encrypt for certificates on hosts you do not own. No other file in `scripts/traefik/` names a docs.plus host.

So copy the folder to a place of your own, and delete `tiny.yml` there. Keep `dynamic/middlewares.yml`, because the routers use it. At the repository root:

```bash
mkdir -p <TRAEFIK_DIR>
cp -R scripts/traefik/. <TRAEFIK_DIR>/
rm -f <TRAEFIK_DIR>/dynamic/tiny.yml
```

`<TRAEFIK_DIR>` is an absolute path outside the clone, for example `/opt/docsplus/traefik`. Then set `TRAEFIK_CONFIG_DIR` to that path in `.env.production`. See [Choose where Traefik reads its config](configuration.md#choose-where-traefik-reads-its-config).

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

`make up-prod` runs `make build` first, so expect a second build. Docker reuses its cache, so it is faster than step 6. The URLs that `make up-prod` prints at the end name the docs.plus servers. Ignore them.

### Finish sign-in

Finish both parts now, before step 10. Step 10 needs Google sign-in on `<APP_HOST>`.

1. Set up sign-in mail. Without custom SMTP, email sign-in works only for members of your Supabase team. Follow [Sign-in mail](configuration.md#sign-in-mail-supabase-auth).
2. Turn on Google sign-in. The admin dashboard signs in with Google only, so nobody can open it without this. Follow [Turn on Google sign-in](configuration.md#turn-on-google-sign-in).

## 9. Verify

At the repository root, list the containers:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production ps
```

From any directory, check the three public hosts:

```bash
curl -sf https://<APP_HOST>/api/health
curl -sf https://<API_HOST>/health
curl -sf https://<ADMIN_HOST>/api/health
```

Each command prints a JSON body. A failure prints nothing and exits non-zero.

Do not use `make status-prod` here. It probes docs.plus itself, so it proves nothing about your server.

Then check each process from inside its container. At the repository root, for the REST API:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec rest-api \
  bun -e "fetch('http://localhost:4000/health').then(r => console.log(r.status))"
```

For the collaboration socket:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec hocuspocus-server \
  bun -e "fetch('http://localhost:4001/health/ready').then(r => console.log(r.status))"
```

Expect `200` from both.

For the worker:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec hocuspocus-worker \
  bun -e "fetch('http://localhost:4002/health').then(r => r.json()).then(h => console.log(h.status))"
```

Expect `healthy`. This route always answers 200, so the status code proves nothing. Only `healthy` means the worker is really draining the save queue.

Last, open `https://<APP_HOST>` in a browser, create a document, type in it, reload, and confirm the text survived. That round trip is the only check that proves the whole chain works: socket, Redis, worker, and database together.

## 10. Make yourself an admin

The admin dashboard admits nobody until you add yourself.

1. Sign in once on `https://<APP_HOST>`, with the Google account you will use for the admin dashboard.
2. In the Supabase dashboard, open **Authentication > Users**, and copy the UID of your user.
3. In the Supabase SQL editor, run this:

```sql
insert into public.admin_users (user_id) values ('<YOUR_SUPABASE_USER_ID>');
```

`<YOUR_SUPABASE_USER_ID>` is the UID you copied.

The admin dashboard then admits you through Google sign-in.

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

**Never route port 4003 through your proxy.** It carries service-role write endpoints. Its internal routes need the service-role key, but `/metrics` has no check.

**The Traefik dashboard on 8080 has no authentication.** It is bound to localhost, and that bind is the only thing protecting it. Next step: reach it over an SSH tunnel, and never change that bind to a public address.

## Things that silently do nothing

Each of these fails quietly. No error, and no log line that names the cause.

- A `NEXT_PUBLIC_` value changed after `make build`. It has no effect until you rebuild.
- `PUBLIC_RESTAPI_URL` unset. Word imports then report every image as dropped, and exports omit pictures.
- `PERSIST_TO_LOCAL_STORAGE=true` in production. Uploads land on one replica and vanish on redeploy.
- Redis unavailable. Rate limiting turns itself off and every request passes.
- A stopped worker. Documents look saved in the editor and never reach the database.

## Updating a value later

Editing `.env.production` is not enough, because a running container keeps its old value. Follow [Recreate, or the change does not land](configuration.md#recreate-or-the-change-does-not-land).

## Upgrade to a new release

Back up your data first. See [Back up your data](README.md#back-up-your-data). Migrations only go forward. There is no down migration, so the backup is your only way back.

Release tags look like `v2.1.0`. `<OLD_TAG>` is the tag you run now, from step 1 or from your last upgrade. `<NEW_TAG>` is the tag you upgrade to. If you run `main`, use the commit you run now in place of `<OLD_TAG>`, and `origin/main` in place of `<NEW_TAG>`.

1. At the repository root, fetch the tags and list them, newest first:

   ```bash
   git fetch --tags
   git tag --list 'v*' --sort=-v:refname
   ```

2. Read the release notes for `<NEW_TAG>`. They are on [GitHub Releases](https://github.com/docs-plus/docs.plus/releases), and in `CHANGELOG.md` at the repository root. Then read the Breaking and Migration sections of [apps/hocuspocus.server/CHANGELOG.md](../../apps/hocuspocus.server/CHANGELOG.md#migration). They list the changes to server config and API routes. Also read this page as `<NEW_TAG>` ships it, because its upgrade steps can differ from these. At the repository root:

   ```bash
   git show <NEW_TAG>:CHANGELOG.md
   git show <NEW_TAG>:apps/hocuspocus.server/CHANGELOG.md
   git show <NEW_TAG>:docs/self-hosting/install.md
   ```

   Where that Migration says `db push`, apply by hand as items 6 and 7 say. Hold every migration that it holds.

   Then compare `.env.example` between the two tags. At the repository root:

   ```bash
   git diff <OLD_TAG> <NEW_TAG> -- .env.example
   ```

   Set each new or changed key in `.env.production` before item 8. A removed line can be a key that only moved. Delete a key from `.env.production` only when the new `.env.example` no longer names it. [Configuration](configuration.md) explains each group.

3. At the repository root, list the Supabase migrations that `<NEW_TAG>` adds:

   ```bash
   git diff --name-only --diff-filter=A <OLD_TAG> <NEW_TAG> -- packages/supabase/migrations
   ```

   `--diff-filter=A` keeps only added files. Each added file is a new migration. If you run `main`, check this list against your own list of applied migrations.

4. Your step 4 edits to `docker-compose.prod.yml` are local changes. Git refuses the checkout when the new tag also changes that file. So set the edits aside, check out the new tag, and put the edits back. At the repository root:

   ```bash
   git stash
   git checkout <NEW_TAG>
   git stash pop
   ```

   `.env.production` is not tracked, so the checkout does not touch it.

   If `git stash pop` reports a conflict, Git keeps the stash and marks the file as unmerged. Open `docker-compose.prod.yml`, remove the conflict markers, and set the hostname lines again, as in step 4. Then, at the repository root:

   ```bash
   git reset -- docker-compose.prod.yml
   git stash drop
   ```

   `git reset` clears the unmerged mark and keeps your edits. `git stash drop` deletes the stash that Git kept. Skip this, and the next upgrade's `git stash` fails.

5. Refresh your Traefik copy. The new tag can change `scripts/traefik/`, and your copy in `<TRAEFIK_DIR>` does not follow it. At the repository root, run the step 4 commands again:

   ```bash
   mkdir -p <TRAEFIK_DIR>
   cp -R scripts/traefik/. <TRAEFIK_DIR>/
   rm -f <TRAEFIK_DIR>/dynamic/tiny.yml
   ```

   The copy overwrites each file in `<TRAEFIK_DIR>` that has the same name, `traefik.yml` too. Add your own edits back, such as the Let's Encrypt email in [Choose where Traefik reads its config](configuration.md#choose-where-traefik-reads-its-config). If `.env.production` does not set `TRAEFIK_CONFIG_DIR` yet, set it now, as in step 4.

6. Apply each new migration by hand in the Supabase SQL editor, in timestamp order. Skip the ones that item 7 holds. An install made from `scripts/` has no migration history, so do not run `supabase db push`. Do not run changed `scripts/*.sql` files again. Those are for a new install.
7. Some migrations must wait. A migration says so in its first comment lines, for example "after the new webapp is live". Hold such a migration until the apps run, and follow the timing it gives. Those comments say "push". For this install, push means apply by hand.
8. At the repository root, build the images:

   ```bash
   make build
   ```

9. At the repository root, run the database migration:

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production run --rm migrate
   ```

10. At the repository root, restart the apps:

    ```bash
    docker compose -f docker-compose.prod.yml --env-file .env.production up -d --no-deps hocuspocus-worker hocuspocus-server rest-api webapp admin-dashboard
    ```

    This gives a short outage, because it recreates all replicas at once.

    Then recreate Traefik. Traefik reads `traefik.yml` only when it starts, so the refreshed copy from item 5 needs a new container. At the repository root:

    ```bash
    docker compose -f docker-compose.prod.yml --env-file .env.production up -d --no-deps --force-recreate traefik
    ```

11. Run the checks in [step 9](#9-verify). Then apply any migrations you held in item 7.
12. Keep a note of `<NEW_TAG>`. The next upgrade uses it as `<OLD_TAG>`. If you run `main`, record the new commit at the repository root:

    ```bash
    git rev-parse HEAD
    ```

### From 1.x

A 1.x install also needs a one-time rewrite of stored media nodes. Follow [Migrate media node names](../../apps/hocuspocus.server/docs/migrate-media-node-names.md).

## Where to go next

- [Back up your data](README.md#back-up-your-data) — what to back up, before your first upgrade.
- [Configuration](configuration.md) — what each setting group does.
- [API overview](../api/README.md) — to call docs.plus from your own code.
