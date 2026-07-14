# @docs.plus/supabase_back

Local Supabase configuration and the database source of truth for docs.plus. Wraps the Supabase CLI (a workspace devDependency — no global install needed); every script loads the root `.env.local`.

## Commands

Run from the repo root:

```bash
bun --filter @docs.plus/supabase_back start    # start local Supabase (applies schema + seed on first run)
bun --filter @docs.plus/supabase_back stop     # stop it
bun --filter @docs.plus/supabase_back status   # ports, keys, health
bun --filter @docs.plus/supabase_back reset    # regenerate seed.sql, then wipe + reseed the local DB
bun --filter @docs.plus/supabase_back types    # regenerate apps/webapp/src/types/supabase.ts
```

`make dev-local` starts Supabase automatically — you rarely need `start` directly.

## Layout

- `scripts/*.sql` — canonical schema, functions, RLS, and seed data for local development. Edit these.
- `seed.sql` — generated from `scripts/` by `generate-seed.ts`; the `reset` script regenerates it. Never edit by hand.
- `migrations/*.sql` — remote (cloud) history only. `config.toml` disables migrations locally by design; local state always comes from `scripts/` via the seed.
- `config.toml` — local stack config. `[db.seed].sql_paths` applies `scripts/00-bootstrap.sql` (pg_cron, pgmq, pg_net, schema `internal`) before `seed.sql`.

Schema changes edit `scripts/*.sql` first, then ship a paired migration for the remote push. After any SQL change, regenerate the webapp types (`types` above).

Full-stack setup: [root README](../../README.md).
