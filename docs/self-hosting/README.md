# Self-hosting requirements

What you must provide before you install docs.plus, and which path to take. When you have all of it, go to [Install](install.md).

This page lists requirements only. For what each setting does, see [Configuration](configuration.md).

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

| Requirement                        | Why                                             | Notes                                                                                          |
| ---------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **A PostgreSQL server**            | Documents and their version history             | The compose file has no database service. Managed or self-run, either is fine.                 |
| **A Supabase project**             | Accounts, chat, notifications, storage policies | Cloud or self-hosted. It needs the `pg_cron` and `pgmq` extensions, which gate email and push. |
| **S3-compatible object storage**   | Uploaded images, video, and audio               | A bucket, an endpoint, a region, and a key pair. Local disk does not work — see below.         |
| **An email sender**                | Invitations, digests, notifications             | SMTP or Resend.                                                                                |
| **A domain, with DNS you control** | TLS, and routing to the right service           | Traefik uses the HTTP challenge, so ports 80 and 443 must be reachable from the internet.      |

Two are optional. A Google OAuth client, if you want Google sign-in. And a Virtuoso Message List licence, if you want the chat feed — that is a paid third-party dependency.

## Host prerequisites

- Docker, with Compose v2
- Bun 1.3.7 or newer
- Node.js 24.11.0 or newer
- GNU Make
- Git

Bun only. This repository never uses npm, yarn, pnpm, or npx.

## Size the machine

Container limits in the compose file total roughly 11.5 GB, and reservations total roughly 3.7 GB. Redis alone reserves 1 GB and may take up to 4 GB.

Next step: start with 8 GB of memory and watch it. Redis is not a cache here — it holds live sync state and unsaved document payloads, so eviction loses work.

## Four things that will surprise you

Read these before you start. Each one has caught somebody.

**Local disk storage does not work in production.** The template ships `STORAGE_TYPE=local` and `PERSIST_TO_LOCAL_STORAGE=true`. The REST API runs two replicas with no shared volume, so an upload lands in one container, is invisible to the other, and disappears on the next deploy. Next step: set `PERSIST_TO_LOCAL_STORAGE=false` and configure object storage before you let anybody upload.

**The Traefik hostnames are hard-coded.** Five label lines in `docker-compose.prod.yml` name `docs.plus`, `prodback.docs.plus`, and `admin.docs.plus`. No environment variable covers them. Next step: edit those five lines to your own domains, or nothing routes.

**Values starting with `NEXT_PUBLIC_` are build arguments, not runtime settings.** Changing one in your environment file does nothing until you rebuild the images. Next step: set them correctly before `make build`.

**Supabase SQL is applied by hand.** There are 42 script files and no deploy pipeline. Order matters. Next step: follow the order in [Install](install.md), and skip the three files that are not schema.

## Then what

Go to [Install](install.md). It is a numbered path from clone to a working site, with a verification step at the end.
