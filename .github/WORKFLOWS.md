# GitHub Workflows Reference

This file is intentionally not named `README.md` so the repository root `README.md` remains the default page on GitHub.

## Active workflows

- `workflows/prod.docs.plus.yml`
  - Production CI/CD pipeline
  - Triggers: push to `main`, PR to `main`, weekly schedule, and `workflow_dispatch`
  - Stages: triage (`parse-build-trigger.sh`) → quality gates → build verification → deploy chain (app → observability → uptime-kuma, fail-fast)
- `workflows/stage.docs.plus.yml`
  - Staging CI/CD pipeline (**not yet migrated** to the four-domain grammar; uses loose `contains()` on `front`/`back`)
  - Triggers: push to `dev`, PR to `dev`, and `workflow_dispatch`
  - Stages: quality gates → build verification → staging deploy
- `workflows/discord-activity.yml`
  - Push activity notifications to Discord
- `workflows/observability.docs.plus.yml`
  - Server-only observability stack (Grafana + Loki + Alloy + Prometheus + GlitchTip)
  - Triggers: `workflow_call` (invoked by the prod orchestrator for deploy commits) and `workflow_dispatch` (`setup|update|restart|down` for manual ops)
  - Runner: self-hosted `prod.docs.plus`; no quality-gate dependency by design

## Deployment trigger grammar (production)

**Format:** `(build): <domain> [<domain> ...] [no-deploy]`

Parsed by `.github/scripts/parse-build-trigger.sh` from the **first line** of the commit subject. Token rules:

- Prefix is literal `(build):` followed by a single space. `build:`, `[build]`, etc. do not match.
- Tokens are lowercase, single-space separated. Commas, slashes, tabs, and double-spaces are rejected.
- Unknown token → **visible red gate** (the tokenizer exits non-zero with an annotation naming the bad token; nothing deploys silently).
- Duplicates dedupe silently (`back back front` → `{back, front}`).
- A subject not starting with `(build)` is a **normal commit**: quality gates run, nothing deploys.

**Four domains** (canonical execution order is fixed regardless of token order in the message):

| #   | Domain          | Validation it runs                                                                              | Deploy target                                                  |
| --- | --------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | `back`          | `backend-ci` — unit tests + real-infra E2E (Postgres/Redis), typecheck, security                | Part of the single app stack                                   |
| 2   | `front`         | lint, webapp unit tests, change-aware per-extension matrix (only changed extensions build/test) | Part of the single app stack                                   |
| 3   | `observability` | —                                                                                               | Grafana + GlitchTip stack (`docker-compose.observability.yml`) |
| 4   | `uptime-kuma`   | —                                                                                               | Uptime-Kuma container (standalone `docker run`)                |

`back` and `front` are not independently deployable. Any app domain (`back` and/or `front`) triggers **one** full-stack blue-green rollout of all five services (`webapp`, `rest-api`, `hocuspocus-server`, `hocuspocus-worker`, `admin-dashboard`). `back` vs `front` vs `back front` differ only in which validation stages run before that single deploy.

**`no-deploy` modifier:** run validation only; skip the app deploy. Valid only alongside `back` and/or `front`; rejected if combined with `observability` or `uptime-kuma`.

## Truth table

Legend: **Back-val** = backend-ci + typecheck + security · **App deploy** = smart front checks + Next.js build + blue-green deploy of all 5 services · **Obs** = observability stack · **UK** = uptime-kuma · ⏭️ = skipped

| Commit subject                                  | Back-val      | App deploy | Obs | UK  | Order                         |
| ----------------------------------------------- | ------------- | ---------- | --- | --- | ----------------------------- |
| `(build): back front observability uptime-kuma` | ✅            | ✅         | ✅  | ✅  | back → front → app → obs → uk |
| `(build): back front`                           | ✅            | ✅         | ⏭️  | ⏭️  | back → front → app            |
| `(build): back observability`                   | ✅            | ✅         | ✅  | ⏭️  | back → app → obs              |
| `(build): front uptime-kuma`                    | ⏭️            | ✅         | ⏭️  | ✅  | front → app → uk              |
| `(build): observability`                        | ⏭️            | ⏭️         | ✅  | ⏭️  | obs only (all app CI skipped) |
| `(build): uptime-kuma`                          | ⏭️            | ⏭️         | ⏭️  | ✅  | uk only                       |
| `(build): back front no-deploy`                 | ✅            | ⏭️         | ⏭️  | ⏭️  | validate only; no deploy      |
| `fix: …` (normal commit)                        | gates only    | ⏭️         | ⏭️  | ⏭️  | quality gates, no deploy      |
| PR to `main`                                    | ✅ gates      | ⏭️         | ⏭️  | ⏭️  | gates + build verification    |
| `schedule` (Sun 00:00 UTC)                      | security only | ⏭️         | n/a | n/a | weekly security audit         |

`workflow_dispatch` with `force_deploy=true` bypasses the commit-message gate and deploys the app; `skip_quality_gates` skips quality gates only.

## Related files

- Composite action: `actions/setup-bun/action.yml`
- Trigger tokenizer: `.github/scripts/parse-build-trigger.sh`
- Workflow docs roadmap: `Notes/CI_CD_Improvement_Roadmap.md`
