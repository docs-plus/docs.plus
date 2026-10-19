# Configuration

Which file you edit, which process reads it, and what happens when a value is wrong. For the numbered install path, see [Install](install.md).

This page does not list every backend variable with its type and default. [`apps/hocuspocus.server/ENV.md`](../../apps/hocuspocus.server/ENV.md) owns that table. It mirrors the validation schema. It also lists the names that the code reads directly, in [Read outside the schema](../../apps/hocuspocus.server/ENV.md#read-outside-the-schema).

## Which file, for which job

| File               | Used by                                            | Tracked in git |
| ------------------ | -------------------------------------------------- | -------------- |
| `.env.example`     | The template you copy. Never read at runtime       | Yes            |
| `.env.production`  | A production deployment, through `--env-file`      | No             |
| `.env.local`       | Local development. `make dev-local` generates it   | No             |
| `.env.development` | Local development defaults. Generated on first run | No             |

Next step: for a server, copy `.env.example` to `.env.production` and edit that one. Leave `.env.example` alone, so the next person still has a clean template.

## Two kinds of value, and the difference matters

**Runtime values** are read when a container starts. Change one, then recreate the container. The exception is a key that `docker-compose.prod.yml` fixes under `environment:`, such as `REDIS_HOST`. The env file cannot change it. [ENV.md](../../apps/hocuspocus.server/ENV.md#keys-that-production-compose-sets) lists these keys.

**Build values** are baked into a compiled bundle. Every name starting with `NEXT_PUBLIC_` is one of these. Changing it in `.env.production` does nothing at all until you run `make build` again.

That difference is the most common configuration mistake here. A `NEXT_PUBLIC_` value that looks correct in your environment file can be months out of date in the running bundle.

## Recreate, or the change does not land

Compose gives your shell environment precedence over `--env-file`, and a running container keeps the value it started with.

Run this at the repository root.

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --force-recreate
```

Next step: run that after any runtime change, then run the checks in [Install step 9](install.md#9-verify). For a `NEXT_PUBLIC_` change, run `make build` first.

## The groups

`.env.example` is organised into sections. These are the ones that matter for a deployment.

| Group                    | Holds                                                                                              | Notes                                                                                                                                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Application and security | Environment name, ports, secrets                                                                   |                                                                                                                                                                                                                    |
| Database                 | `DATABASE_URL`                                                                                     | Your own PostgreSQL. Nothing in the compose file provides it                                                                                                                                                       |
| Redis                    | Host, port, password, database index, timeouts                                                     | Shared by sync, queues, and the rate limiter                                                                                                                                                                       |
| Supabase, server-side    | Project URL, [`SUPABASE_ANON_KEY`](../../apps/hocuspocus.server/ENV.md#required), service-role key | The backend checks each user token with the anon key. `.env.example` ships local demo keys. Replace the anon key and the service-role key with your project's keys. Never expose the service-role key to a browser |
| Supabase, client-side    | The `NEXT_PUBLIC_` pair                                                                            | Build values. See [Webapp and admin build values](#webapp-and-admin-build-values)                                                                                                                                  |
| Storage                  | Endpoint, region, bucket, key pair                                                                 | Set `PERSIST_TO_LOCAL_STORAGE=false`                                                                                                                                                                               |
| Email                    | SMTP or Resend credentials                                                                         | The worker and the REST API both send. Both read `.env.production`                                                                                                                                                 |
| Push notifications       | VAPID key pair                                                                                     | See [Turn on push notifications](#turn-on-push-notifications)                                                                                                                                                      |
| CORS                     | Allowed origins                                                                                    |                                                                                                                                                                                                                    |
| Rate limiting            | `RATE_LIMIT_MAX`                                                                                   | `.env.example` sets 1000. [Rate limiting](../api/README.md#rate-limiting) gives the window and the code default                                                                                                    |
| Logging                  | Level and format                                                                                   |                                                                                                                                                                                                                    |
| Observability            | Metrics and error reporting                                                                        | Optional. See [Observability (optional)](#observability-optional)                                                                                                                                                  |

## Webapp and admin build values

`make build` passes these from `.env.production` into the webapp and admin dashboard images. The two containers have no `env_file`. So a change needs another `make build`, and then a [recreate](#recreate-or-the-change-does-not-land). Each "What it does" cell starts with the app that reads the value.

| Name                                                              | What it does                                                                                                                                                                | When empty                                                                                                                                                                  |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`       | Both apps. Your Supabase project URL and anon key.                                                                                                                          | Required. Both apps stop with a missing-variable error.                                                                                                                     |
| `NEXT_PUBLIC_PROVIDER_URL`                                        | Webapp. The collaboration socket: `wss://<API_HOST>/websocket`. Traefik routes only that path to the socket.                                                                | Required. The webapp stops with a missing-variable error. Without `/websocket`, Traefik answers 404 and the editor never syncs.                                             |
| `NEXT_PUBLIC_RESTAPI_URL`                                         | Webapp. The REST API base: `https://<API_HOST>/api`. Keep `/api`. An old template had `/api/v1`, which no route serves.                                                     | Required. `make build` stops with an error that names `NEXT_PUBLIC_RESTAPI_URL`.                                                                                            |
| `NEXT_PUBLIC_API_URL`                                             | Admin. The REST API origin: `https://<API_HOST>`, with no `/api`. The admin dashboard adds `/api/admin/...` and `/health` itself, so do not copy `NEXT_PUBLIC_RESTAPI_URL`. | Falls back to `https://prodback.docs.plus`, the docs.plus backend.                                                                                                          |
| `NEXT_PUBLIC_APP_URL`                                             | Both apps. Your editor address, `https://<APP_HOST>`. The webapp uses it in canonical and share metadata. The admin dashboard uses it in document links.                    | Falls back to `https://docs.plus`.                                                                                                                                          |
| `NEXT_PUBLIC_SUPABASE_OTP_EMAIL_REDIRECT`                         | Webapp. The base address that a sign-in email link returns to.                                                                                                              | Optional. The link returns to the address where the person asked for it.                                                                                                    |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID`                                    | Webapp. Google One Tap only. The Google sign-in button does not read it. See [Turn on Google sign-in](#turn-on-google-sign-in).                                             | Optional. One Tap does not show. The Google button still works.                                                                                                             |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`                                    | Webapp. The public key that the browser subscribes with. Set the same value as `VAPID_PUBLIC_KEY`, or every push send fails with 403.                                       | Optional. The browser cannot turn on push.                                                                                                                                  |
| `NEXT_PUBLIC_GA_ID`                                               | Webapp. Your Google Analytics ID.                                                                                                                                           | Optional. No analytics script loads.                                                                                                                                        |
| `NEXT_PUBLIC_VIRTUOSO_LICENSE`                                    | Webapp. The license key for the chat message list, `@virtuoso.dev/message-list`.                                                                                            | Chat shows no messages. The list shows a red missing-key notice in their place. With no key, the list works only on `localhost`, `127.0.0.1`, `0.0.0.0` or a `.local` host. |
| `NEXT_PUBLIC_GLITCHTIP_DSN`                                       | Both apps. Sends errors to GlitchTip. See [Observability (optional)](#observability-optional).                                                                              | Optional. No error reports leave the browser or the app server.                                                                                                             |
| `NEXT_PUBLIC_GIT_HASH`                                            | Both apps. The release tag on error reports. Compose fills it from `GIT_HASH` or `DEPLOY_TAG` when it is unset.                                                             | Optional. Error reports carry no release tag.                                                                                                                               |
| `SENTRY_URL`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Webapp. Upload source maps to GlitchTip at build time. The upload runs only when `SENTRY_AUTH_TOKEN` is set.                                                                | Optional. No upload. With a token, set your own org and project, because the defaults are `docsplus` and `prod_docsplus`.                                                   |

`NEXT_PUBLIC_GIPHY_API_KEY` is not a Docker build arg, so a Docker build cannot set it. The GIF picker that reads it is not mounted today.

`NEXT_PUBLIC_SUPABASE_WS_URL` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` are build args too, but no code reads them. See [Values that do nothing](#values-that-do-nothing).

## Template values to fix before you deploy

The template is written for local development. Fix these defaults before you deploy to a server.

**`PERSIST_TO_LOCAL_STORAGE=true`** must become `false`. The REST API runs two replicas with no shared volume. An upload lands in one container, is invisible to the other, and disappears when you recreate the container.

**`NEW_DOCUMENT_NOTIFICATION_EMAILS`** holds two sample addresses at a real domain. Set your own addresses, or leave it empty. Empty sends no new-document mail. See [ENV.md](../../apps/hocuspocus.server/ENV.md#email).

## Choose where Traefik reads its config

`TRAEFIK_CONFIG_DIR` is optional. It names the folder that holds `traefik.yml` and `dynamic/`, and its default is `./scripts/traefik`.

To change a Traefik file, copy `scripts/traefik/` to a folder of your own. Then set `TRAEFIK_CONFIG_DIR` to that folder in `.env.production`.

**The Let's Encrypt email.** Traefik reads it only from `traefik.yml`. In your copy, add `email: <YOUR_EMAIL>` under `certificatesResolvers.letsencrypt.acme`:

```yaml
certificatesResolvers:
  letsencrypt:
    acme:
      email: <YOUR_EMAIL>
      storage: /letsencrypt/acme.json
      httpChallenge:
        entryPoint: web
```

Replace `<YOUR_EMAIL>` with an address you read.

`ACME_EMAIL` in `.env.production` has no effect. The compose file passes it as a command-line flag, and Traefik ignores command-line flags when it loads `traefik.yml`.

## Values that do nothing

These appear in the template or the compose file, and no code reads them. Do not spend time on them.

- `STORAGE_TYPE` — the code branches on `PERSIST_TO_LOCAL_STORAGE` instead.
- `JWT_SECRET` — no consumer, and the production compose file never passes it.
- The four `*_REPLICAS` variables — no compose file reads them. Replica counts are set in `docker-compose.prod.yml` directly.
- `NEXT_PUBLIC_SUPABASE_WS_URL` and `NEXT_PUBLIC_SSE_URL` — the webapp build accepts them, and no code reads them.
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — no code reads it. Sign-in sends no CAPTCHA token, so turning on CAPTCHA in Supabase breaks email sign-in.
- `NEXT_PUBLIC_ADMIN_URL` — no code reads it.
- `TIPTAP_PRO_TOKEN` — no code reads it.
- `HEALTH_CONTROLLER_LOG_LEVEL` and `HEALTH_SERVICE_LOG_LEVEL` — no code reads them.
- `S3_CONNECT_TIMEOUT` and `S3_REQUEST_TIMEOUT` — no code reads them. The S3 timeout is fixed in code at 10 seconds, so the template's `30000` changes nothing.
- `ENVIRONMENT` — no code reads it.
- The `EXPOSE_*_PORT` keys (`EXPOSE_APP_PORT`, `EXPOSE_HOCUSPOCUS_PORT`, `EXPOSE_WORKER_HEALTH_PORT`) — no compose file reads them.

Next step: leave them as they are. Removing them is a repository change, not a deployment step.

## Scaling past the defaults

Replica counts live in `docker-compose.prod.yml`. Raising them is not uniform, because the three backend processes buy different things from a replica. Postgres connections are the shared ceiling, so check your database `max_connections` first.

The short version: the REST API scales fully. The collaboration socket gains connection capacity, but not document capacity. The worker costs twice the database connections of the other two.

Next step: read [`apps/hocuspocus.server/Readme.md`](../../apps/hocuspocus.server/Readme.md#scaling-character) before raising any count.

## When a value is wrong

Most misconfiguration here fails quietly rather than loudly. [Install](install.md) lists the silent ones together. Two are worth repeating.

**Redis unavailable turns rate limiting off**, and every request passes. That is deliberate, because the other choice refused every request while Redis recovered. But a Redis problem then widens your exposure instead of narrowing it.

**An upload cap under 1 MB is ignored** and floored to 10 MB, with a warning at startup. Next step: read the startup log after a cap change.

## Email in 5 minutes

Email is optional. Leave every email variable blank, and email is `off`. The server runs, and it sends no mail.

To send mail, pick one provider. Set its block in `.env.production`, then [recreate the containers](#recreate-or-the-change-does-not-land).

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

Both providers also need `EMAIL_UNSUBSCRIBE_SECRET` and `PUBLIC_RESTAPI_URL`. [ENV.md](../../apps/hocuspocus.server/ENV.md#email) says what breaks without each.

A provider key without `EMAIL_PROVIDER` holds all mail. The worker then logs `email config invalid` with the reason. [`ENV.md`](../../apps/hocuspocus.server/ENV.md#email) lists every rule.

To check the setup, open **Email setup** in the admin dashboard. It shows the status, each problem, and `set` or `missing` for each secret. It never shows a secret value. Under **Lines to add**, it lists the lines that `.env.production` still needs. **Send test email** sends one mail to your own address. The page only reads. Where it says the host env file, it means `.env.production`. To change a value, edit `.env.production`, then [recreate the containers](#recreate-or-the-change-does-not-land).

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
4. Set `RESEND_WEBHOOK_SECRET` to that value in `.env.production`. Then [recreate the containers](#recreate-or-the-change-does-not-land).

A permanent bounce, a complaint or a suppression turns email off for that person. The person sees a notice in the app and can turn email back on in Settings. An `email.failed` event writes nothing, and it logs an `operator` error instead.

Without the secret, the URL answers 404. A secret that is not base64, or decodes to under 24 bytes, logs `email webhook secret invalid` at startup, and the URL stays at 404. Mail still sends in both cases.

### Sign-in mail (Supabase Auth)

Supabase Auth sends sign-in links itself, from its own SMTP settings. The email keys in `.env.production` do not reach it. Without custom SMTP, the Supabase built-in sender sends about 2 mails an hour, and only to members of your Supabase team. So email sign-in fails for everyone outside your Supabase team until you set this up.

1. In the Supabase dashboard, open **Authentication > Emails > SMTP Settings** and turn on **Enable custom SMTP**. With Resend, the Supabase integration in **Resend > Settings > Integrations** fills the form for you. By hand, the values are host `smtp.resend.com`, port `465`, username `resend`, and a Resend API key with **Sending access** as the password. The form also takes a sender email address and a sender name. Use a sender email address on a domain that your provider has verified.
2. Set **Minimum interval per user** to `60` seconds. A lower value lets anyone send a stream of sign-in mail to a stranger's address.
3. Open **Authentication > Rate Limits** and set **Rate limit for sending emails** to the hourly volume you expect, for example `100`. Turning on custom SMTP resets it to 30 per hour.
4. Open **Authentication > Sign In / Providers > Email** and set **Email OTP expiration** to `3600` seconds.
5. Open **Authentication > Emails > Templates**. Paste each branded template from [`apps/hocuspocus.server/templates/`](../../apps/hocuspocus.server/templates/): `magic-link.html` into **Magic Link**, `confirm-signup.html` into **Confirm signup**, and `change-email-address.html` into **Change Email Address**. The default templates are a bare link, and spam filters distrust that on a new domain. Before you paste, replace each `docs.plus` in a template with your own name. It appears in the title, the header, the body, the footer link and the copyright line.
6. Keep click tracking off on the sending domain. Tracking rewrites the link, and the rewritten sign-in link fails.

The templates say that the link expires in 1 hour. If you change **Email OTP expiration**, change that sentence too.

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
2. Check **Site URL**. [Install step 2](install.md#2-prepare-supabase) sets it.
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

**Match the two addresses.** The connector's address is `PUBLIC_RESTAPI_URL` plus `/api/mcp`. The Settings page copies `NEXT_PUBLIC_RESTAPI_URL` plus `/mcp`. The two must match exactly, so `NEXT_PUBLIC_RESTAPI_URL` must equal `PUBLIC_RESTAPI_URL` plus `/api`. When `PUBLIC_RESTAPI_URL` is unset, the server uses the request origin. Behind the proxy, that origin can start with `http`. [ENV.md](../../apps/hocuspocus.server/ENV.md#public-origin) defines the value.

**Check the endpoint.** Run this from any directory.

```bash
curl -si -X POST <PUBLIC_RESTAPI_URL>/api/mcp
```

Replace `<PUBLIC_RESTAPI_URL>` with the public origin of your REST API, such as `https://<API_HOST>`.

The answer is `401`, with a `WWW-Authenticate` header that names a `resource_metadata` URL. Open that URL. Its `authorization_servers` entry must equal the `issuer` you copied, character for character. No proxy change is needed, because the connector sits under `/api`.

**Refuse connected-app tokens in Supabase.** Supabase applies the same RLS to an OAuth token as to a session token. Its [Token Security and RLS](https://supabase.com/docs/guides/auth/oauth-server/token-security) guide says so. `packages/supabase/scripts/31-connected-app-token-gate.sql` makes Supabase refuse a token that carries `client_id`. It covers the Data API, Storage and Realtime. The MCP tools use the service-role key, so the script does not change them.

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

## Turn on Google sign-in

People sign in with Google or an email link. The admin dashboard signs in with Google only, so it needs this section.

**Hosted Supabase.**

First, configure the OAuth consent screen in Google Cloud. For the External user type, publish the app too. While its status is Testing, Google lets only the listed test users sign in. See [Google's consent screen guide](https://developers.google.com/workspace/guides/configure-oauth-consent).

1. In Google Cloud, open **APIs & Services > Credentials**. Create an **OAuth client ID** of type **Web application**.
2. Under **Authorized redirect URIs**, add `<SUPABASE_URL>/auth/v1/callback`.
3. Under **Authorized JavaScript origins**, add `https://<APP_HOST>` and `https://<ADMIN_HOST>`.
4. In the Supabase dashboard, open **Authentication > Sign In / Providers > Google**. Turn it on, and paste the client ID and the client secret.
5. Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in `.env.production` to the same client ID. This value turns on Google One Tap in the webapp. The Google button works without it.
6. Rebuild, because `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is a build value. Run this at the repository root.

   ```bash
   make build
   ```

7. Recreate the containers, as in [Recreate, or the change does not land](#recreate-or-the-change-does-not-land).

Replace `<SUPABASE_URL>` with your Supabase project URL, from the Supabase project settings. Supabase returns each sign-in only to an address on its allow-list. [Install step 2](install.md#2-prepare-supabase) sets that list.

`GOOGLE_CLIENT_ID` and `GOOGLE_SECRET` in the env file feed only `packages/supabase/config.toml`, for the local stack. On a server they do nothing. The secret goes in the Supabase dashboard.

**Local stack.**

1. In Google Cloud, create a Web application client as in step 1 above, or reuse one.
2. Add the redirect URI `http://localhost:54321/auth/v1/callback`.
3. For One Tap, add `http://localhost` and `http://localhost:3000` as JavaScript origins.
4. In `.env.local`, set `GOOGLE_CLIENT_ID` to the client ID and `GOOGLE_SECRET` to the client secret. For One Tap, also set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to the client ID.
5. Supabase reads the two keys only when it starts. Restart it. Run this at the repository root.

   ```bash
   bun --filter @docs.plus/supabase_back stop
   bun --filter @docs.plus/supabase_back start
   ```

Then stop and restart `make dev-local`, so the webapp reads `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

## Turn on push notifications

Push needs a VAPID key pair. The `web-push` package is installed in `apps/hocuspocus.server`, so run this in `apps/hocuspocus.server`.

```bash
bunx web-push generate-vapid-keys
```

It prints a public key and a private key.

1. In `.env.production`, set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` to the two keys.
2. Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` to the same public key.
3. Set `VAPID_SUBJECT` to a `mailto:` address that you read. The template value is a placeholder.
4. Rebuild, because `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is a build value. Run this at the repository root.

   ```bash
   make build
   ```

5. Recreate the containers, as in [Recreate, or the change does not land](#recreate-or-the-change-does-not-land).

[ENV.md](../../apps/hocuspocus.server/ENV.md#push-notifications-vapid) defines the three server keys. [Webapp and admin build values](#webapp-and-admin-build-values) defines the build key.

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

## Observability (optional)

Error reporting is off until you set two values from your GlitchTip project:

- `GLITCHTIP_DSN` — the three backend processes, read at runtime. [ENV.md](../../apps/hocuspocus.server/ENV.md#read-outside-the-schema) defines it.
- `NEXT_PUBLIC_GLITCHTIP_DSN` — the webapp and the admin dashboard. It is a build value. See [Webapp and admin build values](#webapp-and-admin-build-values).

Metrics, logs, and alerts come from a separate stack, `docker-compose.observability.yml`. It reads its own env file. `scripts/observability/.env.example` is the template for that file. Keep your copy outside the repository.

| Variable                      | Purpose                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| `GRAFANA_ADMIN_PASSWORD`      | The password of the Grafana `admin` user                                                      |
| `TELEGRAM_BOT_TOKEN`          | The Telegram bot that sends Grafana alerts                                                    |
| `TELEGRAM_CHAT_ID`            | The Telegram chat that receives the alerts                                                    |
| `TELEGRAM_WARNINGS_CHAT_ID`   | Optional. A second chat for warning alerts. Empty uses `TELEGRAM_CHAT_ID`                     |
| `DEADMAN_WEBHOOK_URL`         | A healthchecks.io ping URL. It pages you when the alert pipeline stops                        |
| `GLITCHTIP_SECRET_KEY`        | The secret key of the GlitchTip server in this stack                                          |
| `GLITCHTIP_POSTGRES_PASSWORD` | The password of the GlitchTip database in this stack                                          |
| `GLITCHTIP_EMAIL_URL`         | Optional. The SMTP URL that GlitchTip sends issue mail with. Empty writes mail to the log     |
| `POSTGRES_EXPORTER_DSN`       | Optional. A read-only `pg_monitor` login for the database exporter. Empty uses `DATABASE_URL` |
| `DATABASE_URL`                | Your docs.plus database. The exporter uses it when `POSTGRES_EXPORTER_DSN` is empty           |

To make the `pg_monitor` login, run this on your database as an admin user:

```sql
CREATE ROLE <EXPORTER_USER> LOGIN PASSWORD '<EXPORTER_PASSWORD>';
GRANT pg_monitor TO <EXPORTER_USER>;
```

The compose file also names the docs.plus hosts. Search it for `docs.plus`, and replace each hit with your own host or address.

The Grafana alert contact points come from a template. Render it before you start the stack. Run this at the repository root.

```bash
set -a; . <PATH_TO_ENV_FILE>; set +a
export TELEGRAM_WARNINGS_CHAT_ID="${TELEGRAM_WARNINGS_CHAT_ID:-$TELEGRAM_CHAT_ID}"
envsubst '${TELEGRAM_BOT_TOKEN} ${TELEGRAM_CHAT_ID} ${TELEGRAM_WARNINGS_CHAT_ID} ${DEADMAN_WEBHOOK_URL}' \
  < scripts/observability/grafana/provisioning/alerting/contactpoints.yml.tmpl \
  > scripts/observability/grafana/provisioning/alerting/contactpoints.yml
```

Then start the stack. It joins `docsplus-network`, which [Install step 5](install.md#5-create-the-docker-network) creates. Run this at the repository root.

```bash
make observability-up OBS_ENV=<PATH_TO_ENV_FILE>
```

Replace `<PATH_TO_ENV_FILE>` with the path to your copy of the env file. Always pass `OBS_ENV`, because the `Makefile` default path belongs to the docs.plus operator's server.

The alerts that [RUNBOOK-backend.md](../RUNBOOK-backend.md) names exist only after this stack runs.

## Where to go next

- [`apps/hocuspocus.server/ENV.md`](../../apps/hocuspocus.server/ENV.md) — every backend variable, its type, and its default.
- [Install](install.md) — the numbered path, and the verification step.
