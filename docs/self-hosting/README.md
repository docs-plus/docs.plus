# Self-hosting requirements

What you must provide before you install docs.plus, and which path to take. When you have all of it, go to [Install](install.md).

This page lists requirements, and how to back up and restore your data. For what each setting does, see [Configuration](configuration.md).

## Pick your path first

**Just trying it out?** You do not need any of this. Clone the repository and run `make dev-local`. That one command starts everything locally, including a database and a local Supabase. See [CONTRIBUTING.md](../../CONTRIBUTING.md).

**Running it for a team, on your own server?** Read on. docs.plus is not a single container, and it does not bring its own database.

## What runs on your server

Eight containers. The compose file starts them all.

| Container           | Job                                                       |
| ------------------- | --------------------------------------------------------- |
| `traefik`           | Reverse proxy and TLS certificates                        |
| `redis`             | Live sync between replicas, job queues, and save payloads |
| `migrate`           | A one-shot database migration job                         |
| `rest-api`          | The HTTP API                                              |
| `hocuspocus-server` | The collaboration socket                                  |
| `hocuspocus-worker` | Saves documents, sends email and push                     |
| `webapp`            | The editor people use                                     |
| `admin-dashboard`   | Operator screens                                          |

**The worker is not optional.** It owns document persistence. Without it, saves sit in Redis and expire after an hour. A running worker is part of the definition of "up".

## What you must provide yourself

None of these ship in the compose file.

| Requirement                        | Why                                                   | Notes                                                                                                                                                                                                                                                   |
| ---------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A PostgreSQL server**            | Documents and their version history                   | The compose file has no database service. Use a separate PostgreSQL server, managed or self-run.                                                                                                                                                        |
| **A Supabase project**             | Accounts, chat, notifications, storage policies       | Supabase Cloud is the tested path. These pages give Cloud dashboard steps only. A self-hosted Supabase stack sets the same Auth values in its own config. Either way, the project needs the `pg_cron` and `pgmq` extensions, which gate email and push. |
| **S3-compatible object storage**   | Uploaded images, video, and audio                     | A bucket, an endpoint, a region, and a key pair. Local disk does not work — see below.                                                                                                                                                                  |
| **An email sender**                | Invitations, digests, notifications, and sign-in mail | SMTP or Resend. See [Email in 5 minutes](configuration.md#email-in-5-minutes). Supabase sign-in mail needs its own SMTP settings. See [Sign-in mail](configuration.md#sign-in-mail-supabase-auth).                                                      |
| **A Google OAuth client**          | The admin dashboard signs in with Google only         | Editor users can still sign in with an email link. The sign-in dialog always shows a Google button, and it fails while the provider is off. See [Turn on Google sign-in](configuration.md#turn-on-google-sign-in).                                      |
| **A domain, with DNS you control** | TLS, and routing to the right service                 | Traefik uses the HTTP challenge, so ports 80 and 443 must be reachable from the internet.                                                                                                                                                               |

Chat also needs a Virtuoso Message List license, a paid third-party key. [Webapp and admin build values](configuration.md#webapp-and-admin-build-values) says where `NEXT_PUBLIC_VIRTUOSO_LICENSE` goes and what breaks without it.

## Host prerequisites

- Docker, with Compose v2
- Bun 1.4.0 or newer
- Node.js 24.11.0 or newer
- GNU Make
- Git

## Size the machine

Container limits in the compose file total roughly 11.5 GB, and reservations total roughly 3.7 GB. Redis alone reserves 1 GB and may take up to 4 GB.

Next step: start with 8 GB of memory and watch it. Redis is not a cache here — it holds live sync state and unsaved document payloads, so eviction loses work.

## Four things that will surprise you

Read these before you start. Each one has caught somebody.

**Local disk storage does not work in production.** The template stores uploads on local disk. The REST API runs two replicas with no shared volume, so an upload lands in one container and disappears on the next deploy. Next step: configure object storage before you let anybody upload. [Template values to fix before you deploy](configuration.md#template-values-to-fix-before-you-deploy) names the value to change.

**The Traefik hostnames are hard-coded.** Five label lines in `docker-compose.prod.yml` name `docs.plus`, `prodback.docs.plus`, and `admin.docs.plus`. No environment variable covers them. The shipped Traefik folder also routes two docs.plus test hosts. Next step: edit those five lines to your own domains, or nothing routes. Then remove the test hosts. [Install, step 4](install.md#4-point-your-domains-at-the-server) has both steps.

**Values starting with `NEXT_PUBLIC_` are build arguments, not runtime settings.** Changing one in your environment file does nothing until you rebuild the images. Next step: set them correctly before `make build`.

**Supabase SQL is applied by hand.** The files are under `packages/supabase/scripts/`, and there is no deploy pipeline. Order matters. Next step: follow the order in [Install](install.md), and skip the three files that are not schema.

## Back up your data

docs.plus does not back up anything for you. Four stores hold your data, and each needs its own backup.

| Store                                   | Holds                                                  |
| --------------------------------------- | ------------------------------------------------------ |
| The `DATABASE_URL` database             | Documents and their version history                    |
| The Supabase database and Storage       | Accounts, chat, notifications, avatars, and chat media |
| The object-storage bucket               | Uploaded images, video, and audio                      |
| The `docsplus_redis-data` Docker volume | Unsaved document payloads and job queues               |

Two more things hold no user data, but you cannot rebuild them from the repository: `.env.production` and your Traefik files.

Keep every copy off the server. A copy on the same disk is lost with the disk.

### The `DATABASE_URL` database

Run `pg_dump` on any machine with the PostgreSQL client tools. Their major version must be the same as the server's, or newer. Run it in the folder where you keep backups.

```bash
pg_dump --format=custom --file=docsplus-db.dump "<PG_URL>"
```

`<PG_URL>` is the `DATABASE_URL` value from `.env.production`, without its Prisma-only parameters, such as `connection_limit` and `pool_timeout`. Prisma reads those, and `pg_dump` rejects them. Keep `sslmode`.

### Supabase

Supabase takes its own database backups. What it keeps depends on your plan. See the [Supabase backups guide](https://supabase.com/docs/guides/platform/backups).

For a copy you hold yourself, run `pg_dump` against the project's direct connection string. See the provider's docs for where to find it.

```bash
pg_dump --format=custom --file=supabase-db.dump "<SUPABASE_CONNECTION_STRING>"
```

Database backups, from Supabase or from `pg_dump`, do not include Storage objects. Back up Storage separately. See the provider's docs.

### Redis

The compose file runs Redis with `--appendonly yes`, so Redis writes every change to the `docsplus_redis-data` volume. That data includes document payloads the worker has not saved yet. The compose file sets `name: docsplus`, so Docker prefixes the volume name with `docsplus_`.

At the repository root, copy the volume to a file:

```bash
docker run --rm -v docsplus_redis-data:/data:ro -v "$PWD":/backup alpine tar czf /backup/redis-data.tgz -C /data .
```

Redis writes its file once a second, so a copy of a running volume can miss the last second. Do not copy while Redis rewrites its append-only file. See [Redis persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/) for how to check.

### Object storage

Copy the bucket with your provider's tool. In the folder where you keep backups, an S3-compatible sync looks like this:

```bash
aws s3 sync s3://<BUCKET> ./bucket-backup
```

`<BUCKET>` is the `DO_STORAGE_BUCKET` value. A provider other than AWS also needs its endpoint, which is the `DO_STORAGE_ENDPOINT` value. See your provider's docs for its tool and its endpoint setting.

### `.env.production`

This file holds every secret the stack uses. Store a copy in a place only operators can read, for example a password manager.

Losing `EMAIL_UNSUBSCRIBE_SECRET` is the worst case. A new secret breaks every unsubscribe link sent in the last 90 days, because each link is signed with the old one. See [ENV.md, Email](../../apps/hocuspocus.server/ENV.md#email).

### Traefik

The `docsplus_traefik-certs` volume holds your TLS certificates. Without it, Traefik requests new ones, and Let's Encrypt limits how often you can do that. At the repository root:

```bash
docker run --rm -v docsplus_traefik-certs:/letsencrypt:ro -v "$PWD":/backup alpine tar czf /backup/traefik-certs.tgz -C /letsencrypt .
```

Also copy `<TRAEFIK_DIR>`, the Traefik folder you made in [Install, step 4](install.md#4-point-your-domains-at-the-server).

### Restore

Restore in this order, before you start the apps.

1. On a new server, clone the repository as in [Install, step 1](install.md#1-clone), and check out the tag or commit you ran, `<OLD_TAG>`. Put `.env.production` back at the repository root, and `<TRAEFIK_DIR>` back at its path. Repeat the hostname edits in `docker-compose.prod.yml` from [Install, step 4](install.md#4-point-your-domains-at-the-server), because a fresh clone names the docs.plus hosts. Point your DNS records at the new server. Then create the Docker network and build the images, as in steps 5 and 6.

   If you restore into a new Supabase project, its URL and keys change. Update them in `.env.production` before step 6.

2. In the folder that holds your backups, restore the `DATABASE_URL` database into an empty database:

   ```bash
   pg_restore --no-owner --dbname="<PG_URL>" docsplus-db.dump
   ```

   Then run the database migration, as in [Install, step 7](install.md#7-run-the-database-migration).

3. Restore Supabase with its own restore tools. See the [Supabase backups guide](https://supabase.com/docs/guides/platform/backups).
4. Copy the bucket back with the same sync, with the source and target swapped:

   ```bash
   aws s3 sync ./bucket-backup s3://<BUCKET>
   ```

5. Let Compose create the volumes, then fill them while Redis and Traefik are stopped. At the repository root:

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production up --no-start redis traefik
   docker run --rm -v docsplus_redis-data:/data -v "$PWD":/backup alpine tar xzf /backup/redis-data.tgz -C /data
   docker run --rm -v docsplus_traefik-certs:/letsencrypt -v "$PWD":/backup alpine tar xzf /backup/traefik-certs.tgz -C /letsencrypt
   ```

   Unsaved payloads expire after an hour, so an older Redis copy does not bring them back.

6. Start the stack, as in [Install, step 8](install.md#8-start), and run the checks in [step 9](install.md#9-verify).

## Then what

Go to [Install](install.md). It is a numbered path from clone to a working site, with a verification step at the end.
