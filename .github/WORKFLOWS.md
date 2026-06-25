# GitHub Workflows Reference

This file is intentionally not named `README.md` so the repository root `README.md` remains the default page on GitHub.

## Active workflows

- `workflows/prod.docs.plus.yml`
  - Production CI/CD pipeline
  - Triggers: push to `main`, PR to `main`, weekly schedule, and `workflow_dispatch`
  - Stages: quality gates -> build verification -> production deploy
- `workflows/stage.docs.plus.yml`
  - Staging CI/CD pipeline
  - Triggers: push to `dev`, PR to `dev`, and `workflow_dispatch`
  - Stages: quality gates -> build verification -> staging deploy
- `workflows/discord-activity.yml`
  - Push activity notifications to Discord
- `workflows/observability.docs.plus.yml`
  - Server-only observability stack (Grafana + Loki + Alloy + Prometheus + GlitchTip)
  - Triggers: push to `main` with `(build): observability`, and `workflow_dispatch` (`setup|update|restart|down`)
  - Runner: self-hosted `prod.docs.plus`; no quality-gate dependency by design

## Deployment trigger notes

Current production/staging deploy jobs still check commit message keywords in workflow logic:

- must contain `build`
- and either `front` or `back`

The observability pipeline uses a separate `(build): observability` keyword (alongside `(build): uptime-kuma`).

`workflow_dispatch` supports manual override inputs (`force_deploy`, `skip_quality_gates`) as configured in each workflow file.

## Related files

- Composite action: `actions/setup-bun/action.yml`
- Workflow docs roadmap: `Notes/CI_CD_Improvement_Roadmap.md`
