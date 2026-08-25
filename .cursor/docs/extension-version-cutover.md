# Extension family — Phase 1 cutover tracker

Rotating state for the five publishable `@docs.plus/extension-*` packages during Phase 1 (independent `2.0.0` → npm; stable-only, no `@next`). Delete this file in the lockstep switch-flip PR that activates Phase 2. Authoritative policy: [RELEASE_POLICY.md](../../RELEASE_POLICY.md).

## npm publish status

**Cutover complete — all five shipped 2026-08-11.** Every package publishes `2.0.0`, serves it as npm `latest`, and carries a git tag and a GitHub Release.

| Package                                | Local `package.json` | Current `latest` | `2.0.0` on npm | `2.0.0` git tag | `2.0.0` GitHub Release |
| -------------------------------------- | -------------------- | ---------------- | -------------- | --------------- | ---------------------- |
| `@docs.plus/extension-hyperlink`       | 2.0.0                | 2.0.0            | ✅ 2026-08-11  | ✅              | ✅                     |
| `@docs.plus/extension-hypermultimedia` | 2.0.0                | 2.0.0            | ✅ 2026-08-11  | ✅              | ✅                     |
| `@docs.plus/extension-indent`          | 2.0.0                | 2.0.0            | ✅ 2026-08-11  | ✅              | ✅                     |
| `@docs.plus/extension-inline-code`     | 2.0.0                | 2.0.0            | ✅ 2026-08-11  | ✅              | ✅                     |
| `@docs.plus/extension-placeholder`     | 2.0.0                | 2.0.0            | ✅ 2026-08-11  | ✅              | ✅                     |

Registry state verified 2026-08-11 against `npm view`. `extension-hyperlink` still carries the stray `4.3.0`, published 2026-04-19 by mistake and unremovable — npm's 72-hour unpublish window closed 2026-04-22. It outranks `2.0.0` by semver, so it stays at the top of the version list. Its deprecation message now reads "Mispublished by mistake — not a real release. Install 2.x instead.", replacing npm's generic string. Deprecation warns at install but never blocks one, so the message was the only remaining lever.

The table is now final for Phase 1. This file is deleted by the switch-flip PR that activates Phase 2 — see [Trigger D](../../RELEASE_POLICY.md#trigger-d--when-strict-lockstep-activates). The runbook below stays until then, because it is the record of how these five shipped.

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
