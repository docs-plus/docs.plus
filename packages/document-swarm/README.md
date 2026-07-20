# @docs.plus/document-swarm

Internal CLI that drives N seeded users into a docs.plus document and has them collaborate — write prose, build task lists, draft an academy-style outline, and chat under headings. Two modes: **demo** (paced, watchable) and **stress** (concurrent load). Local and stage only; production is refused by design.

Not published. Runs on Bun + Playwright.

## Glossary

Terms (`Swarm Actor`, `Swarm Target`, `Write Target`, `Heading Chat Surface`, `Script Outcome`, `Swarm Host`, `Swarm Script`, `Shuffle`, `Contention`, `Ramp`, `Swarm Report`, `Actor cap`) are defined in the root [`CONTEXT.md`](../../CONTEXT.md) under **Document swarm**.

## Prerequisites

- The webapp, Hocuspocus, and Supabase running (`make dev-local`) for a local target, or a reachable stage deploy.
- Env from the repo root `.env.local` (the scripts load it): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and a REST base (`SERVER_RESTAPI_URL` or `NEXT_PUBLIC_RESTAPI_URL`).
- The Chromium binary Playwright drives (one-time):

```bash
bunx playwright install chromium
```

## Provision the actor pool

Creates or reuses `swarm-actor-<n>` accounts through the Supabase Admin API and writes `actors.json` (gitignored). Idempotent — rerun to grow the pool.

```bash
bun run --filter @docs.plus/document-swarm provision --count 20
```

## Run

```bash
# Demo — headed, until-stopped, low contention (watch a live pad; Ctrl+C to stop)
bun run --filter @docs.plus/document-swarm run \
  --mode demo --users 5 --url http://localhost:3000/<public-slug>

# Stress — headless, bounded, high contention, weighted script mix
bun run --filter @docs.plus/document-swarm run \
  --mode stress --users 10 --url https://stage.docs.plus/<public-slug> --duration 5m --shuffle
```

The target must be public and editable; Private, Read-only, soft-deleted, or missing documents are refused before any browser opens.

## Flags

| Flag                      | Default       | Notes                                                                             |
| ------------------------- | ------------- | --------------------------------------------------------------------------------- |
| `--mode`                  | `demo`        | `demo` or `stress`.                                                               |
| `--users`                 | `5`           | Concurrent Swarm Actors. Capped at 20 local / 10 stage.                           |
| `--url`                   | —             | Required. The Swarm Target document URL.                                          |
| `--duration`              | `5m` (stress) | e.g. `30s`, `5m`, `1h`. Demo defaults to until-stopped.                           |
| `--until-stopped`         | —             | Run until Ctrl+C (Demo default).                                                  |
| `--contention`            | mode-based    | `low` (per-actor sections) or `high` (one shared heading). Demo→low, stress→high. |
| `--shuffle`               | off           | Draw scripts weighted-at-random instead of round-robin.                           |
| `--headed` / `--headless` | mode-based    | Demo→headed, stress→headless.                                                     |
| `--ramp`                  | `1000`        | Milliseconds between consecutive actor joins.                                     |
| `--force`                 | off           | Override the per-host actor cap.                                                  |
| `--actors-file`           | `actors.json` | Path to the provisioned pool.                                                     |

## Swarm Report

Every run ends with a summary (joins, scripts, chat messages, hard failures) and an exit code: **non-zero when any actor hard-failed** (never joined, or an unrecoverable error). Per-script hiccups are counted but do not fail the run.

## Safety

- Only `localhost`, `127.0.0.1`, `*.local`, `stage.docs.plus`, and `*.stage.docs.plus` are allowed. Any other host is refused.
- `--users` above the host cap is refused unless you pass `--force`.
- `actors.json` holds credentials and is gitignored — keep it that way.
