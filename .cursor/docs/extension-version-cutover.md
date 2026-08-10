# Extension family — Phase 1 cutover tracker

Rotating state for the five publishable `@docs.plus/extension-*` packages during Phase 1 (independent `2.0.0` → npm; stable-only, no `@next`). Delete this file in the lockstep switch-flip PR that activates Phase 2. Authoritative policy: [RELEASE_POLICY.md](../../RELEASE_POLICY.md).

## npm publish status

**Current `latest`** is the version npm serves today, before the cutover. The three `2.0.0` columns track the cutover itself. A `—` there means that step has not happened yet, not that the package is absent from npm.

| Package                                | Local `package.json` | Current `latest` | `2.0.0` on npm | `2.0.0` git tag | `2.0.0` GitHub Release |
| -------------------------------------- | -------------------- | ---------------- | -------------- | --------------- | ---------------------- |
| `@docs.plus/extension-hyperlink`       | 2.0.0                | 1.5.2            | —              | —               | —                      |
| `@docs.plus/extension-hypermultimedia` | 2.0.0                | 1.4.0            | —              | —               | —                      |
| `@docs.plus/extension-indent`          | 2.0.0                | 0.1.1            | —              | —               | —                      |
| `@docs.plus/extension-inline-code`     | 2.0.0                | never published  | —              | —               | —                      |
| `@docs.plus/extension-placeholder`     | 2.0.0                | never published  | —              | —               | —                      |

Registry state verified 2026-08-07. `extension-hyperlink` also carries a stray `4.3.0`, published 2026-04-19 by mistake. `latest` points at `1.5.2`, not `4.3.0`. But `4.3.0` outranks every other published version by semver, so it sits at the top of the version list. It already carries npm's generic deprecation string; deprecation warns but never blocks an install, so the message is the only lever — see step 9.

Update the table as each package ships: fill its three `2.0.0` columns and move `2.0.0` into **Current `latest`**. Publishes are stable-only (`latest`); there is no `@next` column to track and no promotion step.

## Phase 1 publish runbook (per package)

Manual gate — no `release:family` until Phase 2. Run from repo root on `main` with a clean tree matching `origin/main`.

1. **Verify locally:** `bash scripts/build-extensions.sh` then `EXTENSION_DIST_READY=1 bash scripts/run-tests.sh --extensions`
2. **Build:** `bun run --filter @docs.plus/extension-<name> build`
3. **Preflight:** per package — `npm_config_user_agent=bun/1.3.14 bun run --filter @docs.plus/extension-<name> prepublishOnly`; all five — `bash scripts/extension-preflight.sh`
4. **Pack inspect (optional):** `cd extensions/extension-<name> && bun publish --dry-run` (lifecycle hooks use `bunx release-*`)
5. **Publish:** `cd extensions/extension-<name> && bun publish --tag latest --otp <6-digit>` — **Bun only**, not `npm publish` (`catalog:` peers)
6. **Tag:** `git tag '@docs.plus/extension-<name>@2.0.0'` then `git push origin '@docs.plus/extension-<name>@2.0.0'` — never `git push --tags`
7. **GitHub Release:** `gh release create '@docs.plus/extension-<name>@2.0.0' --notes "$(awk '/^## /{ if (found) exit; if (/^## \[2\.0\.0\]/) found=1 } found' extensions/extension-<name>/CHANGELOG.md)"`
8. **Discord:** fires from `.github/workflows/discord-release.yml` after the GitHub Release — one embed per package (five embeds if all ship the same day; accepted policy)
9. **Hyperlink only:** re-deprecate `4.3.0` before or with the `2.0.0` announce. It is already deprecated, but with npm's generic `"this package has been deprecated"`; re-running `npm deprecate` overwrites the message with one that names `2.x`. npm's 72-hour unpublish window closed on 2026-04-22, so the message is the only remaining lever. The command and rationale are in [RELEASE_POLICY.md § Phase 1](../../RELEASE_POLICY.md#phase-1--cutover-current); the CHANGELOG Security section carries the consumer-facing disclosure.

**Suggested cutover order:** hyperlink first (autolink partner for hypermultimedia), then hypermultimedia, indent, inline-code, placeholder.

## Docker build coverage

| Image                    | Extensions built in image                                                                        | Notes                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/webapp`            | All five + `floating-popover` + `floating-tooltip`                                               | Full `build-extensions` stage                                                                                                                  |
| `apps/hocuspocus.server` | hyperlink + hypermultimedia + inline-code (runtime); indent/placeholder stub `package.json` only | Migration imports hypermultimedia + inline-code, document-conversion imports hyperlink — indent/placeholder regressions do not fail this image |

## Maintainer tooling

Harness scripts, ports, `docs:screenshots`, and CI wiring: [extensions/README.md § Contributing](../../extensions/README.md#contributing).
