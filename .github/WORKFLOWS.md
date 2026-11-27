# GitHub Workflows Reference

This file is intentionally not named `README.md` so the repository root `README.md` remains the default page on GitHub.

## Active workflows

- `workflows/prod.docs.plus.yml`
  - Production CI/CD pipeline
  - Triggers: push to `main`, PR to `main`, weekly schedule, and `workflow_dispatch`
  - Stages: triage (`parse-build-trigger.sh`) → quality gates and the prod-host `images` build → build verification → deploy chain (app → observability → uptime-kuma, fail-fast) → run report
  - Build Verification uploads the webapp Next trace files as the `webapp-next-trace-<sha>` artifact, kept 7 days. The webapp Docker build prints Next's `next:build:build-traces` debug lines. Both are measurement aids and never fail a run
  - Deploy guard: `GLITCHTIP_DSN` and `NEXT_PUBLIC_GLITCHTIP_DSN` must be non-empty in the host `.env` or the `images` job aborts before building
  - A later push to `main` while the `images` job runs cancels that run's deploy. To ship it, push a new `(build):` tip or run a `force_deploy` dispatch. A later `(build):` push can also remove the images of an earlier run whose deploy has not started. That deploy then stops at `📦 Verify images present`, and production is unchanged.
  - `📦 Verify images present` also stops the deploy when the host env file changed after `images` copied it, because the webapp image baked the old `NEXT_PUBLIC_*` values. Use Re-run all jobs. Production is unchanged.
  - Disk guard: before the build, it removes old `docsplus-*` tags. It keeps this run's tag, the last-good tag and every image a container uses. Then it prunes the build cache toward 45 GB free and keeps at least 15 GB of cache. It aborts below 20 GB free and exposes `free_gb_before`, `free_gb` and `load1` as `images` job outputs
  - A manual dispatch with `force_deploy` deploys only from `main`. From any other branch, the deploy job skips ([#437](https://github.com/docs-plus/docs.plus/issues/437))
  - The deploy copies `scripts/traefik/` to `/opt/projects/prod.docs.plus/.deploy/traefik/` before `up -d traefik redis`. It rewrites only a changed dynamic file, by rename. Traefik reads that copy through `TRAEFIK_CONFIG_DIR` in the host `.env`, so a checkout on the runner does not change live routing
  - Self-hosted runner `prod.docs.plus` runs from `/opt/actions-runner/prod` under its `svc.sh` systemd unit with a runner-only `.env` (`0` app keys in `Runner.Worker`). Host env files (`.env`, `.env.observability`, `.env.github-relay`) and `.deploy/` stay in `/opt/projects/prod.docs.plus` ([#743](https://github.com/docs-plus/docs.plus/issues/743))
  - Two GitHub settings are manual, not code ([#437](https://github.com/docs-plus/docs.plus/issues/437)). The `production` environment should allow only `main`. A `prod.docs.plus` runner group should accept only `prod.docs.plus.yml`, `observability.docs.plus.yml`, and `github-relay.docs.plus.yml` from `main`
  - On success, posts a `deploy <sha>` annotation to Grafana. On failure, it notifies Telegram (credentials from the host's `.env.observability`). The rollback runs only after `🚀 Deploy Services` has started (`ROLL_STARTED`). The notice has five texts: aborted before touching prod (env guard or missing images; production unchanged), stopped in Ensure Infrastructure (app unchanged), migration failed (app unchanged), rolled back to the previous tag, or rollback failed (manual intervention). The `images` job sends its own notice when it fails (env guard, disk guard or image build). `🧹 Remove Unshipped Images` removes the images of a run whose deploy never started.
  - Every run, the weekly cron included, ends with `📊 Run Report`. It writes job times, deploy steps and the benchmark metrics (M1, M2g, M2i, M3, M4, M5, W, M6) to the run summary. It reads the API only and never fails the run
- `workflows/github-relay.docs.plus.yml`
  - Server-only deploy for `apps/github-relay` (`docker-compose.github-relay.yml`), decoupled from app deploys
  - Triggers: `workflow_dispatch` (`setup|update|restart|down`) on `prod.docs.plus` from `main`; alerts Telegram on deploy failure
  - Receives GitHub repository webhooks and posts Discord Components V2 cards to `#github`, `#triage`, and `#releases`
- `workflows/observability.docs.plus.yml`
  - Server-only observability stack (Grafana + Loki + Alloy + Prometheus + GlitchTip)
  - Triggers: `workflow_call` (invoked by the prod orchestrator for deploy commits) and `workflow_dispatch` (`setup|update|restart|down` for manual ops)
  - Runner: self-hosted `prod.docs.plus`; no quality-gate dependency by design
  - Both jobs run only on `main`. A dispatch from another branch skips them. Inside `workflow_call`, `github.ref` is the caller's ref, so the push to `main` still deploys ([#437](https://github.com/docs-plus/docs.plus/issues/437))
  - `DEADMAN_WEBHOOK_URL` is required in `.env.observability` (missing value fails the deploy — no placeholder fallback)
  - `DATABASE_URL` is still required in `.env.observability`. `postgres-exporter` prefers the optional `POSTGRES_EXPORTER_DSN`, the connection string for a read-only `pg_monitor` login. It falls back to `DATABASE_URL` while that key is unset
  - Setup/update validates `prometheus.yml` with `promtool` before `up -d`, then restarts prometheus + grafana so mounted config edits load; failures notify Telegram
  - `glitchtip-web` and `glitchtip-worker` share the named `glitchtip-uploads` volume at `/code/uploads` so uploaded sourcemaps persist across restarts and assemble into debug symbol bundles ([#841](https://github.com/docs-plus/docs.plus/issues/841))
- `workflows/runner-watchdog.yml`
  - Every 30 min (GitHub-hosted): checks the repo's self-hosted runner status and notifies Telegram when a runner is offline **or when zero runners are registered**. GitHub auto-deregisters runners dead >14 days, so an empty list is the terminal failure state, not health
  - Needs three repo secrets: `RUNNER_WATCHDOG_TOKEN` (fine-grained PAT, repo Administration: read), `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`. Without them each run warns with the missing names and checks nothing
- `workflows/chatroom-e2e.yml`
  - Chatroom browser tests on a PR or push to `main` when webapp, extension or package code changes, plus `workflow_dispatch`
  - A failed `push` run sends a Telegram alert only when the suite turns red after a green run (`.github/scripts/notify-e2e-red-after-green.sh`, ruled on #557 2026-11-12). A suite that stays red does not alert again. It uses the `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` repo secrets, and it is not a deploy gate
- `workflows/editor-e2e.yml`
  - Editor browser tests on the `/editor` playground, on a push to `main` with the `chatroom-e2e.yml` paths list, plus `workflow_dispatch`. No pull request trigger ([#477](https://github.com/docs-plus/docs.plus/issues/477))
  - `scripts/test-editor.sh` sets `EDITOR_ONLY_STACK` through `CYPRESS_EXPOSE`, so the three `filter/*` specs, which need REST and WS, report as pending
  - A failed `push` run alerts only on red after green, like `chatroom-e2e.yml`. It is not a deploy gate
- `workflows/lockstep-guard.yml`
  - Fails a PR that changes an extension `package.json` when the publishable extension versions differ. The `lockstep-bypass` label skips it
- `workflows/supabase-policies.yml`
  - Runs the pgTAP files in `packages/supabase/tests/` against a fresh local Supabase stack ([#583](https://github.com/docs-plus/docs.plus/issues/583))
  - Triggers: a PR to `main` that touches `packages/supabase/**` or this workflow, the weekly cron (Sunday 00:00 UTC), and `workflow_dispatch`
  - Uses no secrets, so fork pull requests run it. Realtime stays on, because the seed writes policies on `realtime.messages`. It is not a deploy gate
- `workflows/codeql.yml`
  - Semantic static security analysis (CodeQL `security-extended`, excluding test, playground, and local benchmark/dev script paths) for `javascript-typescript` and GitHub `actions` workflows on GitHub-hosted `ubuntu-latest`
  - Triggers: push to `main` (skipping `(build):` empty triggers), PR to `main`, weekly cron (Monday 04:17 UTC), and `workflow_dispatch`. Publishes findings to GitHub Code Scanning; never uses the production runner. It is not a deploy gate
- `workflows/scorecard.yml`
  - OpenSSF Scorecard supply-chain security audit on GitHub-hosted `ubuntu-latest` (`publish_results: true` publishes results publicly to `api.scorecard.dev`, uploads a 5-day `SARIF file` artifact, and reports to GitHub Code Scanning)
  - Triggers: push to `main`, `branch_protection_rule`, weekly cron (Monday 03:31 UTC), and `workflow_dispatch` (default branch only). It is not a deploy gate

`backend-ci.yml` and `quality-lint.yml` are reusable workflows (`workflow_call`). The prod workflow calls both.

## Deployment trigger grammar (production)

**Format:** `(build): <domain> [<domain> ...] [no-deploy]`

Parsed by `.github/scripts/parse-build-trigger.sh` from the **first line** of the commit subject. Token rules:

- Prefix is literal `(build):` followed by a single space. `build:`, `[build]`, etc. do not match.
- Tokens are lowercase, single-space separated. Commas, slashes, tabs, and double-spaces are rejected.
- Unknown token → **visible red gate** (the tokenizer exits non-zero with an annotation naming the bad token; nothing deploys silently).
- Duplicates dedupe silently (`back back front` → `{back, front}`).
- A subject not starting with `(build)` is a **normal commit**: quality gates run, nothing deploys.

**Four domains** (the canonical order is fixed regardless of token order in the message):

| #   | Domain          | Validation it runs                                                                              | Deploy target                                                  |
| --- | --------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | `back`          | `backend-ci` — unit tests + real-infra E2E (Postgres/Redis), typecheck, security                | Part of the single app stack                                   |
| 2   | `front`         | lint, webapp unit tests, change-aware per-extension matrix (only changed extensions build/test) | Part of the single app stack                                   |
| 3   | `observability` | —                                                                                               | Grafana + GlitchTip stack (`docker-compose.observability.yml`) |
| 4   | `uptime-kuma`   | —                                                                                               | Uptime Kuma stack (`docker-compose.uptime-kuma.yml`)           |

`back` and `front` are not independently deployable. Any app domain (`back` and/or `front`) triggers **one** full-stack blue-green rollout of all five services (`webapp`, `rest-api`, `hocuspocus-server`, `hocuspocus-worker`, `admin-dashboard`). `back` vs `front` vs `back front` differ only in which validation stages run before that single deploy.

**`no-deploy` modifier:** run validation only; skip the app deploy. Valid only alongside `back` and/or `front`; rejected if combined with `observability` or `uptime-kuma`.

## Truth table

Legend: **Back-val** = backend-ci + typecheck + security · **App deploy** = smart front checks + Next.js build + blue-green deploy of all 5 services · **Obs** = observability stack · **UK** = uptime-kuma · ⏭️ = skipped

| Commit subject                                  | Back-val                          | App deploy | Obs | UK  | Order                                         |
| ----------------------------------------------- | --------------------------------- | ---------- | --- | --- | --------------------------------------------- |
| `(build): back front observability uptime-kuma` | ✅                                | ✅         | ✅  | ✅  | back + front → app → obs → uk                 |
| `(build): back front`                           | ✅                                | ✅         | ⏭️  | ⏭️  | back + front → app                            |
| `(build): back observability`                   | ✅                                | ✅         | ✅  | ⏭️  | back → app → obs                              |
| `(build): front uptime-kuma`                    | ✅                                | ✅         | ⏭️  | ✅  | back + front → app → uk                       |
| `(build): observability`                        | ⏭️                                | ⏭️         | ✅  | ⏭️  | obs only (all app CI skipped)                 |
| `(build): uptime-kuma`                          | ⏭️                                | ⏭️         | ⏭️  | ✅  | uk only                                       |
| `(build): back front no-deploy`                 | ✅                                | ⏭️         | ⏭️  | ⏭️  | validate only; no deploy                      |
| `fix: …` (normal commit)                        | typecheck by scope, no backend-ci | ⏭️         | ⏭️  | ⏭️  | gates for changed scopes, no deploy           |
| PR to `main`                                    | changed scopes                    | ⏭️         | ⏭️  | ⏭️  | gates + build verification for changed scopes |
| `schedule` (Sun 00:00 UTC)                      | security only                     | ⏭️         | n/a | n/a | weekly security audit                         |

`back + front` means the two validations run at the same time. Build Verification and the app deploy wait for both. Every app deploy runs Back-val, because the deploy runs the migration and rolls all three backend services.

`workflow_dispatch` with `force_deploy=true` bypasses the commit-message gate and deploys the app; `skip_quality_gates` skips quality gates only.

`backend_no_cache` is a temporary input for one A/B test ([#566](https://github.com/docs-plus/docs.plus/issues/566)). Push deploys always build the backend with `--no-cache`.

## Change scopes (PRs and pushes without `(build):`)

`🔎 Detect Changes` runs `.github/scripts/detect-change-scopes.sh` on the changed files. It emits `webapp`, `admin`, `backend` and `docs_only`. Lint and security always run.

The script classes each changed path by the first row that matches.

| Order | Class                  | Paths                                                                                                                                                                                                                                                      | Effect                                                                                   |
| ----- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1     | Never docs             | `extensions/*/README.md`, `extensions/*/CHANGELOG.md`, any path under a `src/` folder, `apps/webapp/public/**`                                                                                                                                             | Skips row 2. Row 3 still applies, so anything under `extensions/<ext>/assets/` is media. |
| 2     | Docs                   | `**/*.md`, `docs/**`, `.agents/**`, `.github/ISSUE_TEMPLATE/**`, root `LICENSE`                                                                                                                                                                            | No scope. Counts toward `docs_only`.                                                     |
| 3     | Extension README media | `extensions/<ext>/assets/**`, and a `.gif`, `.png`, `.jpg`, `.jpeg`, `.webp` or `.mp4` file at an extension root                                                                                                                                           | No scope                                                                                 |
| 4     | Shared                 | Root `package.json`, `bun.lock`, `bunfig.toml`, `tsconfig*.json`, `tsup.base.ts`, `.prettierrc*`, `.prettierignore`, `eslint.config.*`, `.stylelintrc*`, `docker-compose*.yml`; `.github/**`; `scripts/**`; `packages/eslint-config/**`                    | Every scope on                                                                           |
| 5     | webapp                 | `apps/webapp/**`, `extensions/**`, `packages/floating-*/**`, `packages/supabase/**`, `packages/pad-url/**`                                                                                                                                                 | `webapp` on                                                                              |
| 5     | admin                  | `apps/admin-dashboard/**`                                                                                                                                                                                                                                  | `admin` on                                                                               |
| 5     | backend                | `apps/hocuspocus.server/**`, `packages/email-templates/**`, `packages/pad-url/**`, `packages/supabase/**`, `packages/floating-*/**`, `extensions/extension-hyperlink/**`, `extensions/extension-hypermultimedia/**`, `extensions/extension-inline-code/**` | `backend` on                                                                             |
| 6     | Unmatched              | Any other path, for example `packages/document-swarm/**`, `packages/playground/**`, `packages/release-tooling/**`, `Makefile`, `.cursor/rules/*.mdc`                                                                                                       | Every scope on                                                                           |

`docs_only` is `true` only when every path is in row 2. Row 2 comes before row 4, so `.github/WORKFLOWS.md` and `.github/PULL_REQUEST_TEMPLATE.md` count as docs. `.agents/**` is docs because no gate except lint reads it, and lint always runs ([#759](https://github.com/docs-plus/docs.plus/issues/759)).

| Job                                    | Runs when                                                                                                             |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| triage, Detect Changes, lint, security | Always                                                                                                                |
| Type Check                             | `webapp`, `admin` or `backend` is on                                                                                  |
| Backend Validation                     | Pull request: `backend` is on. Push without `(build):`: never.                                                        |
| Ext suites                             | The extension filter selects the suite, and `docs_only` is not `true`                                                 |
| Ext bytes                              | Pull request only, when the filter selects `extension-hyperlink`, `extension-hypermultimedia`, or `extension-mermaid` |
| Webapp Unit Tests                      | `webapp` is on                                                                                                        |
| Build Verification                     | `webapp` or `admin` is on, and every gate passed or was skipped                                                       |
| deploy, observability, Uptime Kuma     | Unchanged                                                                                                             |

Every scope is on for a `(build):` push, a `workflow_dispatch`, the weekly cron, a missing diff base, more than 500 files, a missing file count, an empty list, or a list whose length differs from the count. The `scopes` step logs one class line per path and a `reason` line.

A new push cancels the older run in its group, and a push run diffs only its own push. So on a push, the `gap` step reads the previous push run and its jobs through `gh api`, with `actions: read`. If that run was cancelled, or has not completed, before every gate job ended, every scope and every extension suite turns on. The step logs `reason=forced-after-cancel`. Deploy-chain jobs and the run report are not gates. An unreadable run also forces every scope, with `reason=forced-unreadable-run` ([#759](https://github.com/docs-plus/docs.plus/issues/759)).

## Related files

- Composite actions: `actions/setup-bun/action.yml`, `actions/setup-cypress/action.yml`, `actions/build-extensions/action.yml`
- Cache rule for `setup-bun` and `setup-cypress`: pull requests restore only. Other events save once per key. The `--ignore-scripts` install never saves.
- `setup-bun` pins the Bun version for CI. Bump it by hand. The Docker images stay on `oven/bun:1-slim`. After the build, `🥟 Compare image Bun with CI Bun` writes both versions to the run summary and warns when they differ. It never fails a deploy. When it warns, bump `setup-bun` and `lockstep-guard.yml` together (#650).
- Trigger tokenizer: `.github/scripts/parse-build-trigger.sh`
- Change-scope classifier: `.github/scripts/detect-change-scopes.sh` (test: `detect-change-scopes.test.sh`)
- Cancelled-push check: `.github/scripts/detect-cancel-gap.sh` (test: `detect-cancel-gap.test.sh`)
- Telegram notifier: `scripts/ci/notify-telegram.sh` (shared by prod deploy, observability, runner-watchdog, chatroom-e2e, and editor-e2e failure steps; never fails the caller)
- Run report: `.github/scripts/write-run-report.sh` (reads `gh run view --json jobs` output; prints Markdown)
