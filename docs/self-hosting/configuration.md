# Configuration

Which file you edit, which process reads it, and what happens when a value is wrong. For the numbered install path, see [Install](install.md).

This page does not list every variable with its type and default. [`apps/hocuspocus.server/ENV.md`](../../apps/hocuspocus.server/ENV.md) owns that table, and it mirrors the validation schema, so it cannot drift.

## Which file, for which job

| File               | Used by                                            | Tracked in git |
| ------------------ | -------------------------------------------------- | -------------- |
| `.env.example`     | The template you copy. Never read at runtime       | Yes            |
| `.env.production`  | A production deployment, through `--env-file`      | No             |
| `.env.local`       | Local development. `make dev-local` generates it   | No             |
| `.env.development` | Local development defaults. Generated on first run | No             |

Next step: for a server, copy `.env.example` to `.env.production` and edit that one. Leave `.env.example` alone, so the next person still has a clean template.

## Two kinds of value, and the difference matters

**Runtime values** are read when a container starts. Change one, recreate the container, done.

**Build values** are baked into a compiled bundle. Every name starting with `NEXT_PUBLIC_` is one of these. Changing it in `.env.production` does nothing at all until you run `make build` again.

That difference is the most common configuration mistake here. A `NEXT_PUBLIC_` value that looks correct in your environment file can be months out of date in the running bundle.

## Recreate, or the change does not land

Compose gives your shell environment precedence over `--env-file`, and a running container keeps the value it started with.

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --force-recreate
```

Next step: run that after any runtime change, then confirm with `make status-prod`. For a `NEXT_PUBLIC_` change, run `make build` first.

## The groups

`.env.example` is organised into sections. These are the ones that matter for a deployment.

| Group                    | Holds                                | Notes                                                        |
| ------------------------ | ------------------------------------ | ------------------------------------------------------------ |
| Application and security | Environment name, ports, secrets     |                                                              |
| Database                 | `DATABASE_URL`                       | Your own PostgreSQL. Nothing in the compose file provides it |
| Redis                    | Host, port, database index, timeouts | Shared by sync, queues, and the rate limiter                 |
| Supabase, server-side    | Project URL, service-role key        | Never expose the service-role key to a browser               |
| Supabase, client-side    | The `NEXT_PUBLIC_` pair              | Build values. See above                                      |
| Storage                  | Endpoint, region, bucket, key pair   | Set `PERSIST_TO_LOCAL_STORAGE=false`                         |
| Email                    | SMTP or Resend credentials           | The worker sends; the API never does                         |
| Push notifications       | VAPID key pair                       | Generate with `bunx web-push generate-vapid-keys`            |
| CORS                     | Allowed origins                      |                                                              |
| Rate limiting            | `RATE_LIMIT_MAX` and the window      | Default is 100 requests per 15 minutes per address           |
| Logging                  | Level and format                     |                                                              |
| Observability            | Metrics and error reporting          | Optional                                                     |

## Three template values to fix before you deploy

The template is written for local development, so three of its defaults are wrong for a server.

**`PERSIST_TO_LOCAL_STORAGE=true`** must become `false`. The REST API runs two replicas with no shared volume, so an upload lands in one container, is invisible to the other, and disappears on redeploy.

**`NEXT_PUBLIC_RESTAPI_URL` must end in `/api`.** There is no `/api/v1` route. An older template carried one, and the neighbouring `SERVER_RESTAPI_URL` was already correct, which is how the mistake survived unnoticed. Check your own `.env` if you copied an early template.

**`ACME_EMAIL` is missing entirely.** Traefik falls back to the maintainer's address for Let's Encrypt registration. Add it.

## Choose where Traefik reads its config

`TRAEFIK_CONFIG_DIR` is optional. It names the folder that holds `traefik.yml` and `dynamic/`, and its default is `./scripts/traefik`.

## Values that do nothing

These appear in the template and are read nowhere. Do not spend time on them.

- `STORAGE_TYPE` — the code branches on `PERSIST_TO_LOCAL_STORAGE` instead.
- `JWT_SECRET` — no consumer, and the production compose file never passes it.
- The four `*_REPLICAS` variables — no compose file reads them. Replica counts are set in `docker-compose.prod.yml` directly.

Next step: leave them as they are. Removing them is a repository change, not a deployment step.

## Scaling past the defaults

Replica counts live in `docker-compose.prod.yml`. Raising them is not uniform, because the three backend processes buy different things from a replica. Postgres connections are the shared ceiling, so check your database `max_connections` first.

The short version: the REST API scales fully. The collaboration socket gains connection capacity, but not document capacity. The worker costs twice the database connections of the other two.

Next step: read [`apps/hocuspocus.server/Readme.md`](../../apps/hocuspocus.server/Readme.md#scaling-character) before raising any count.

## When a value is wrong

Most misconfiguration here fails quietly rather than loudly. [Install](install.md) lists the silent ones together. Two are worth repeating.

**Redis unavailable turns rate limiting off**, and every request passes. That is deliberate — the alternative was refusing every request while Redis recovered — but it means a Redis problem widens your exposure instead of narrowing it.

**An upload cap under 1 MB is ignored** and floored to 10 MB, with a warning at startup. Next step: read the startup log after a cap change.

## Email in 5 minutes

Email is optional. Leave every email variable blank, and email is `off`. The server runs, and it sends no mail.

To send mail, pick one provider. Set its block in the host `.env`, then redeploy.

```
# Resend
EMAIL_PROVIDER=resend
EMAIL_FROM="Acme Docs <notify@mail.acme.com>"
RESEND_API_KEY=re_...
RESEND_WEBHOOK_SECRET=whsec_...   # optional: bounces and complaints

# or SMTP
EMAIL_PROVIDER=smtp
EMAIL_FROM="Acme Docs <notify@acme.com>"
SMTP_HOST=smtp.acme.com
SMTP_PORT=465
SMTP_USER=...   # leave both blank for a relay with no sign-in
SMTP_PASS=...
```

Both providers also need `EMAIL_UNSUBSCRIBE_SECRET` and `PUBLIC_RESTAPI_URL`. Without `EMAIL_UNSUBSCRIBE_SECRET`, every unsubscribe link is rejected. Without `PUBLIC_RESTAPI_URL`, the one-click unsubscribe header is left out.

A provider key without `EMAIL_PROVIDER` holds all mail. The worker then logs `email config invalid` with the reason. [`ENV.md`](../../apps/hocuspocus.server/ENV.md#email) lists every rule.

To check the setup, open **Email setup** in the admin dashboard. It shows the status, each problem, and `set` or `missing` for each secret. It never shows a secret value. It also lists the `.env` lines to add, and **Send test email** sends one mail to your own address. The page only reads. To change a value, edit the host env file, then redeploy.

Then add DNS records for the domain in `EMAIL_FROM`:

- **SPF:** the record your provider gives you.
- **DKIM:** the keys your provider gives you.
- **DMARC:** start with `p=none`. Read the reports before you make the policy stricter.

Without SPF and DKIM, most inboxes reject the mail or mark it as spam.

People get email only after they opt in. Each person turns it on in Settings, on the Notifications tab. Until then, no notification or digest mail goes to them.

### Bounces and complaints (Resend)

This step is optional. Without it, Resend still sends mail, but the server never learns about a dead address or a spam report.

1. In the Resend dashboard, open **Webhooks** and add an endpoint. The URL is `PUBLIC_RESTAPI_URL` followed by `/api/email/webhooks/resend`, for example `https://api.acme.com/api/email/webhooks/resend`.
2. Pick four events: `email.bounced`, `email.complained`, `email.suppressed` and `email.failed`.
3. Copy the endpoint's signing secret. It starts with `whsec_`.
4. Set `RESEND_WEBHOOK_SECRET` to that value in the host `.env`, then redeploy.

A permanent bounce, a complaint or a suppression turns email off for that person. The person sees a notice in the app and can turn email back on in Settings. An `email.failed` event writes nothing, and it logs an `operator` error instead.

Without the secret, the URL answers 404. A secret that is not base64, or decodes to under 24 bytes, logs `email webhook secret invalid` at startup, and the URL stays at 404. Mail still sends in both cases.

### Your privacy duties

When you run docs.plus for other people, the duties below are yours:

- You are the controller of your users' data.
- Sign your email provider's data processing agreement (DPA).
- Each email carries short extracts of document and chat text. Your provider stores them.
- Edit `apps/webapp/src/components/pages/legal/legalMetadata.ts` and the `/privacy` page before you go live. They name the docs.plus operator, not you.

## Turn on the MCP connector

The MCP connector at `/api/mcp` lets people use docs.plus from Claude or ChatGPT. It needs the Supabase OAuth server. For the user side, see [Use docs.plus from Claude or ChatGPT](../mcp/README.md). For the tools and limits, see [MCP connector reference](../mcp/reference.md).

The chat tools also need [`SUPABASE_SERVICE_ROLE_KEY`](../../apps/hocuspocus.server/ENV.md#security). Without it, they answer `Chat is not available on this docs.plus server.` Settings > Connected apps needs the key too, to read each app's redirect URIs. Without it, every connected app shows as unverified. The limit of 60 tool calls per minute needs [Redis](../../apps/hocuspocus.server/ENV.md#redis). Without Redis, that limit is off.

**Hosted Supabase.** In the Supabase dashboard, open **Authentication > OAuth Server**.

1. Turn on **Enable the Supabase OAuth Server**.
2. Check **Site URL**. It comes from **Authentication > URL Configuration**, and it must be your webapp address.
3. Set **Authorization Path** to `/oauth/consent`.
4. Turn on **Allow Dynamic OAuth Apps**.
5. Choose **Save changes**.
6. Open **Project Settings > JWT Keys**. The current signing key must be asymmetric (`ES256` or `RS256`). If the legacy JWT secret is still current, choose **Rotate keys**. AI apps ask for `openid`, and Supabase cannot sign that ID token with the legacy `HS256` secret. The token step then fails with `HS256 is not supported for ID token signing`. Rotation signs nobody out. Do not revoke the legacy secret: the `anon` and `service_role` keys are signed with it.

The Supabase CLI does not push these settings, so set them in the dashboard.

**Local stack.** `packages/supabase/config.toml` already turns the OAuth server on.

```toml
[auth.oauth_server]
enabled = true
authorization_url_path = "/oauth/consent"
allow_dynamic_registration = true
```

After you change that file, restart Supabase. Run this at the repository root.

```bash
bun --filter @docs.plus/supabase_back stop
bun --filter @docs.plus/supabase_back start
```

**Check discovery.** Run this from any directory.

```bash
curl -s <SUPABASE_URL>/auth/v1/.well-known/openid-configuration
```

Replace `<SUPABASE_URL>` with your Supabase project URL, from the Supabase project settings. Locally it is `http://127.0.0.1:54321`.

The answer must list `registration_endpoint`. If it is missing, the OAuth server or dynamic registration is off. Copy the `issuer` value exactly, and set [`MCP_AUTH_ISSUER`](../../apps/hocuspocus.server/ENV.md) to it. On a server, recreate the containers, as [above](#recreate-or-the-change-does-not-land). Locally, stop and restart `make dev-local`.

**Check the endpoint.** Run this from any directory.

```bash
curl -si -X POST <PUBLIC_RESTAPI_URL>/api/mcp
```

Replace `<PUBLIC_RESTAPI_URL>` with the public origin of your REST API, such as `https://prodback.docs.plus`.

The answer is `401`, with a `WWW-Authenticate` header that names a `resource_metadata` URL. Open that URL. Its `authorization_servers` entry must equal the `issuer` you copied, character for character. No proxy change is needed, because the connector sits under `/api`.

**Refuse connected-app tokens in Supabase.** Supabase applies the same RLS to an OAuth token as to a session token, as its [Token Security and RLS](https://supabase.com/docs/guides/auth/oauth-server/token-security) guide says. `packages/supabase/scripts/31-connected-app-token-gate.sql` makes Supabase refuse a token that carries `client_id`. It covers the Data API, Storage and Realtime. The MCP tools use the service-role key, so the script does not change them.

A new install runs this script with the other numbered files, as [Install](install.md#2-prepare-supabase) says. An existing install runs it once in the SQL editor. The paired migration `20260928120000_refuse_connected_app_tokens` has the same body, for a `supabase db push`. Both are safe to run again.

Before you run it, check two things.

1. Run `select rolconfig from pg_roles where rolname = 'authenticator';`. If the answer already sets `pgrst.db_pre_request`, merge both checks into one function first. The script replaces that setting.
2. Check that PostgREST is version 12 or later. The Supabase dashboard shows it under **Project Settings > Infrastructure**. An older version still refuses the token, but answers `500` instead of `403`.

After it runs, open a document with chat while signed in. Messages load and a send works. A connected app's token now gets `403` with the code `connected_app` from `<SUPABASE_URL>/rest/v1/`. One MCP tool call still works.

The script adds a policy to each table in the `supabase_realtime` publication. After you add a table to that publication, run the script again.

If the site breaks, this turns the Data API check off. Run it in the SQL editor.

```sql
alter role authenticator reset pgrst.db_pre_request;
notify pgrst, 'reload config';
```

The Storage and Realtime policies stay. Each is named `Connected apps use only the MCP server`. They sit on `storage.objects`, on `realtime.messages`, and on each public table in `supabase_realtime`. Drop each one with `drop policy if exists`.

## Turn off password sign-in

docs.plus does not use passwords. People sign in with Google or an email link. Turn on this hook, so that no account can sign in with a password.

`packages/supabase/scripts/32-password-sign-in-hook.sql` creates the function `public.hook_block_password_tokens`. A new install runs it with the other numbered files. An existing install runs it once in the SQL editor, or pushes the paired migration `20260928130000_reject_password_sign_in_hook`. Both are safe to run again.

The function is a Custom Access Token hook, which every Supabase plan has. It refuses a token for a password sign-in and passes every other sign-in through unchanged. Keep **Confirm email** on. With it off, a first sign-in by email link also fails.

**Hosted Supabase.** In the Supabase dashboard, open **Authentication > Hooks**. Add the **Customize Access Token (JWT) Claims** hook, choose **Postgres**, and pick that function. The hook runs each time Supabase issues a token. If sign-in or a token refresh fails after you turn it on, turn the hook off again.

**Secure password change.** In the same dashboard, open the **Email** provider settings and turn on **Secure password change**. It asks for a recent sign-in before a password change. Supabase counts a session under 24 hours old as recent, so this setting is only an extra layer. The hook is the control that refuses a password sign-in.

**Local stack.** `packages/supabase/config.toml` sets `secure_password_change = true` under `[auth.email]`. It has the hook block, commented out.

```toml
# [auth.hook.custom_access_token]
# enabled = true
# uri = "pg-functions://postgres/public/hook_block_password_tokens"
```

The hook stays off locally, because the backend e2e scripts and document-swarm sign in with a password. With the hook on, those scripts fail. To turn it on, remove the `#` marks. Also set `enable_confirmations = true` under `[auth.email]`, so that a first email-link sign-in still works. Then restart Supabase. Run this at the repository root.

```bash
bun --filter @docs.plus/supabase_back stop
bun --filter @docs.plus/supabase_back start
```

## Where to go next

- [`apps/hocuspocus.server/ENV.md`](../../apps/hocuspocus.server/ENV.md) — every backend variable, its type, and its default.
- [Install](install.md) — the numbered path, and the verification step.
