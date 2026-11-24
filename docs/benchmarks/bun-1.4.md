# Bun 1.4.x Benchmark Report

On one developer laptop (`2026-11-16`), moving from `tsc` to `bun check` cut 15-workspace type checking from `5.28 s` to `0.44 s` (**`91 %` less time**, median of `5`) ([#794](https://github.com/docs-plus/docs.plus/issues/794#issuecomment-6918366984)). Moving format checks from Prettier to `bun fmt` cut the gate command from `10.82 s` to `0.15 s` (**`98 %` less time**, median of `5`) and matched Prettier byte for byte across `2,582` files ([#795](https://github.com/docs-plus/docs.plus/issues/795#issuecomment-6918368106)). On CI (`ubuntu-latest`), `📝 Type Check All` dropped from `22 s` to `2 s` (**`90 %` less time**, median of `7` before, `5` after) ([#794 CI](https://github.com/docs-plus/docs.plus/issues/794#issuecomment-7124292179)). Production runtime memory has no Bun before-and-after comparison because historical Prometheus series expired before measurement ([#652](https://github.com/docs-plus/docs.plus/issues/652#issuecomment-6762062857)).

> **What this report does not show:** Laptop developer-loop numbers do not transfer to CI or production. CI Bun also changed mid-window (`1.4.1 -> 1.4.4`), so pipeline deploy time (`630 s` vs `1,090 s`) sits as non-Bun CI context ([#569](https://github.com/docs-plus/docs.plus/issues/569#issuecomment-6812443811)). Security fixes ([#651](https://github.com/docs-plus/docs.plus/issues/651), [#659](https://github.com/docs-plus/docs.plus/issues/659)) are excluded.

---

## Developer Loop (Laptop and CI)

### Claims ([#796](https://github.com/docs-plus/docs.plus/issues/796))

- "Type-checking all 15 docs.plus workspaces fell from 5.28 s to 0.44 s on one laptop (median of 5), 91 % less time." ([#794](https://github.com/docs-plus/docs.plus/issues/794#issuecomment-6918366984))
- "The docs.plus format check fell from 10.82 s to 0.15 s on one laptop (median of 5), 98 % less time." ([#795](https://github.com/docs-plus/docs.plus/issues/795#issuecomment-6918368106))

### Developer-loop results

| Check                                                 | Machine, date & condition                                                                                                             | `n` (before / after) | Before (median, min–max)    | After (median, min–max)     | Change               | Source                                                                                   |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | --------------------------- | --------------------------- | -------------------- | ---------------------------------------------------------------------------------------- |
| 15-workspace `typecheck` (`tsc` -> `bun check`)       | Laptop (`Mac17,6`, Bun `1.4.4`, `2026-11-16`, scratch clone `5fc138dad`, load `< 6`, 1 warm-up discarded)                             | `5` / `5`            | `5.28 s` (`5.13–5.54 s`)    | `0.44 s` (`0.43–0.46 s`)    | **`91 %` less time** | [#794 laptop](https://github.com/docs-plus/docs.plus/issues/794#issuecomment-6918366984) |
| Format gate command (`prettier` -> `bun fmt --check`) | Laptop (`Mac17,6`, Bun `1.4.4`, `2026-11-16`, `5fc138dad` -> `b87090be4`, `0` of `2,582` diffs)                                       | `5` / `5`            | `10.82 s` (`10.73–11.82 s`) | `0.15 s` (`0.14–0.15 s`)    | **`98 %` less time** | [#795 laptop](https://github.com/docs-plus/docs.plus/issues/795#issuecomment-6918368106) |
| Full local `bun run check:ci`                         | Laptop (`Mac17,6`, Bun `1.4.4`, `2026-11-16`, `5fc138dad` -> `b87090be4`)                                                             | `5` / `5`            | `97.24 s` (`96.86–99.38 s`) | `85.54 s` (`85.08–86.30 s`) | **`12 %` less time** | [#795 laptop](https://github.com/docs-plus/docs.plus/issues/795#issuecomment-6918368106) |
| `bun run format`                                      | Laptop (`Mac17,6`, Bun `1.4.4`, `2026-11-16`, `5fc138dad` -> `b87090be4`)                                                             | `5` / `5`            | `10.22 s` (`9.66–10.42 s`)  | `0.13 s` (`0.13–0.14 s`)    | **`98 %` less time** | [#795 laptop](https://github.com/docs-plus/docs.plus/issues/795#issuecomment-6918368106) |
| `lint-staged` tasks on one `.tsx` file                | Laptop (`Mac17,6`, Bun `1.4.4`, `2026-11-16`, tasks only; excludes `git add`)                                                         | `5` / `5`            | `0.42 s` (`0.41–0.44 s`)    | `0.36 s` (`0.35–0.36 s`)    | **`14 %` less time** | [#795 laptop](https://github.com/docs-plus/docs.plus/issues/795#issuecomment-6918368106) |
| CI `📝 Type Check All` step                           | CI `ubuntu-latest`, Bun `1.4.4` (before `2026-11-07`–`2026-11-11`; after `2026-11-16`–`2026-11-17`, runs `43876524495`–`44041325574`) | `7` / `5`            | `22 s` (`18–32 s`)          | `2 s` (`1–3 s`)             | **`90 %` less time** | [#794 CI](https://github.com/docs-plus/docs.plus/issues/794#issuecomment-7124292179)     |
| CI `bun fmt --check .` step (`quality-lint.yml`)      | CI `ubuntu-latest`, Bun `1.4.4` (`2026-11-16`–`2026-11-17`, runs `43876524495`–`44041325574`)                                         | — / `5`              | Not logged apart from step  | `0.37 s` (`0.29–0.47 s`)    | Context only         | [#795 CI](https://github.com/docs-plus/docs.plus/issues/795#issuecomment-7124293884)     |
| Hint (`n < 5`): CI `📝 Type Check All` on Bun `1.4.5` | CI `ubuntu-latest`, Bun `1.4.5` (`2026-11-23`, single run `45132328837`)                                                              | — / `1`              | —                           | `1 s` (single run)          | Hint only            | [#794 CI](https://github.com/docs-plus/docs.plus/issues/794#issuecomment-7124292179)     |
| Hint (`n < 5`): CI `bun fmt --check .` on Bun `1.4.5` | CI `ubuntu-latest`, Bun `1.4.5` (`2026-11-23`, single run `45132328837`)                                                              | — / `1`              | —                           | `0.29 s` (single run)       | Hint only            | [#795 CI](https://github.com/docs-plus/docs.plus/issues/795#issuecomment-7124293884)     |

In the same laptop `typecheck` run (`Mac17,6`, Bun `1.4.4`, `2026-11-16`, `n = 5` each), peak process RSS dropped from `1,118 MiB` (`tsc`) to `325 MiB` (`bun check`, **`70 %` less memory**; median only logged, no `min–max` recorded) ([#794 laptop](https://github.com/docs-plus/docs.plus/issues/794#issuecomment-6918366984)). Seeded-error controls passed on all `18` TypeScript configs (`tsc` and `bun check` reported identical `TS2305`, `TS2345`, `TS2741` errors) and all `6` format-control files byte for byte (including Tailwind class sorting) ([#794](https://github.com/docs-plus/docs.plus/issues/794#issuecomment-6918366984), [#795](https://github.com/docs-plus/docs.plus/issues/795#issuecomment-6918368106)).

---

## CI/CD Time to Live (Non-Bun Context)

- "A docs.plus production deploy now goes live in a median of 630 s, down from 1090 s (n = 14 before, 2026-09-22 to 2026-10-20; n = 8 after, 2026-11-03 to 2026-11-07)." Condition: the `620 s` median target is missed by `10 s` ([#569 ruling](https://github.com/docs-plus/docs.plus/issues/569#issuecomment-6812444293)).

| Metric                 | Machine, date & condition                                                                                                                                                  | `n` (before / after) | Before (median, min–max)  | After (median, min–max) | Change               | Source                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------------------- | ----------------------- | -------------------- | ------------------------------------------------------------------------------------------ |
| M1 deploy time to live | Production CI/CD (`ubuntu-latest` gates + 4-vCPU runner, attempt `1`; before `2026-09-22`–`2026-10-20`; after `2026-11-03`–`2026-11-07`, runs `41608014517`–`42344958557`) | `14` / `8`           | `1,090 s` (`777–1,510 s`) | `630 s` (`595–714 s`)   | **`42 %` less time** | [#569 Measured](https://github.com/docs-plus/docs.plus/issues/569#issuecomment-6812443811) |

Through `2026-11-09` (run `42582921035`, `n = 14 / 10`), `M1` p90 deploy time moved from `1,386 s` before to `673 s` after ([#569 Measured](https://github.com/docs-plus/docs.plus/issues/569#issuecomment-6812443811)). CI moved from Bun `1.4.1` to `1.4.4` mid-window (commit `72f08af7a`, row `5` onward), so this M1 gain reflects CI/CD workflow architecture changes rather than a pure Bun version upgrade.

---

## Production Runtime Memory (No Bun Claim)

Current memory snapshot with no Bun before-and-after claim: production moved to Bun `1.4.4` on `2026-10-23`, and the 15-day Prometheus retention dropped the `1.4.3 -> 1.4.4` boundary before a clean read ran ([#652 ruling](https://github.com/docs-plus/docs.plus/issues/652#issuecomment-6762062857)). Production traffic is also low, so idle memory dominates.

At the single `2026-11-10 09:44Z` read (Bun `1.4.4`, `24f302ae0`, deploy run `42689997917`, containers running ~`13.5 h`), cAdvisor working-set memory and process RSS measured ([#652 Measured](https://github.com/docs-plus/docs.plus/issues/652#issuecomment-6764197853)):

- Webapp: `151.3–151.6 MiB` working set.
- REST API: `195.1–218.4 MiB` working set (`230.3–270.8 MiB` process RSS).
- Hocuspocus WebSocket server: `203.5–216.9 MiB` working set (`243.3–254.8 MiB` process RSS).
- Hocuspocus worker: `144.1–150.6 MiB` working set (`172.4–179.0 MiB` process RSS).
- Admin dashboard: `92.5 MiB` working set.

**Context baselines (not comparable):** Earlier repo notes list `130–154 MB` for the WebSocket service (`2026-09-05`, Bun `1.4.0`) and `~560 MB` for webapp plus REST (`2026-10-21`, Bun `1.4.3`). Those notes do not record measurement method (process RSS, `docker stats`, or working set), whether `MB` meant `MiB`, or container uptime, and unrelated features shipped in between (such as document social cards live since `2026-11-03`).

---

## Method and Linked Sources

Every figure above links directly to its published `Measured` or ruling comment:

1. **Type check (`#794`):** [Laptop before/after (`2026-11-16`)](https://github.com/docs-plus/docs.plus/issues/794#issuecomment-6918366984) and [CI step timings (`2026-11-24`)](https://github.com/docs-plus/docs.plus/issues/794#issuecomment-7124292179).
2. **Format gate (`#795`):** [Laptop before/after (`2026-11-16`)](https://github.com/docs-plus/docs.plus/issues/795#issuecomment-6918368106) and [CI step timings (`2026-11-24`)](https://github.com/docs-plus/docs.plus/issues/795#issuecomment-7124293884).
3. **CI/CD pipeline context (`#569`):** [Window 1 stats (`2026-11-11`)](https://github.com/docs-plus/docs.plus/issues/569#issuecomment-6812443811) and [verdict ruling (`2026-11-12`)](https://github.com/docs-plus/docs.plus/issues/569#issuecomment-6812444293).
4. **Production memory context (`#652`):** [Cut-scope ruling (`2026-11-10`)](https://github.com/docs-plus/docs.plus/issues/652#issuecomment-6762062857) and [instant memory read (`2026-11-10`)](https://github.com/docs-plus/docs.plus/issues/652#issuecomment-6764197853).
5. **Internal tooling note (`#657`):** Turning off default coverage in `apps/hocuspocus.server/bunfig.toml` lowered `bun test` wall time from `16.93 s` (`16.57–18.72 s`) to `16.21 s` (`16.18–16.21 s`, `4 %` less time, `n = 5` on `Mac17,6`, Bun `1.4.4`, `2026-11-12`, `45edac16a`, `1209/7/0` both sides; internal engineering speedup, excluded from result tables) ([#657 Measured](https://github.com/docs-plus/docs.plus/issues/657#issuecomment-6823504817)).
