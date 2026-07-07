# Extension family — Phase 1 cutover tracker

Rotating state for the five publishable `@docs.plus/extension-*` packages during Phase 1 (independent `2.0.0` → npm; stable-only, no `@next`). Delete this file in the lockstep switch-flip PR that activates Phase 2. Authoritative policy: [RELEASE_POLICY.md](../../RELEASE_POLICY.md).

## npm publish status

| Package                                | Local `package.json` | On npm | Git tag | GitHub Release |
| -------------------------------------- | -------------------- | ------ | ------- | -------------- |
| `@docs.plus/extension-hyperlink`       | 2.0.0                | —      | —       | —              |
| `@docs.plus/extension-hypermultimedia` | 2.0.0                | —      | —       | —              |
| `@docs.plus/extension-indent`          | 2.0.0                | —      | —       | —              |
| `@docs.plus/extension-inline-code`     | 2.0.0                | —      | —       | —              |
| `@docs.plus/extension-placeholder`     | 2.0.0                | —      | —       | —              |

Update the table as each package ships. Publishes are stable-only (`latest`); there is no `@next` column to track and no promotion step.

## Phase 1 publish runbook (per package)

Manual gate — no `release:family` until Phase 2. Run from repo root on `main` with a clean tree matching `origin/main`.

1. **Verify locally:** `bash scripts/build-extensions.sh` then `EXTENSION_DIST_READY=1 bash scripts/run-tests.sh --extensions`
2. **Build:** `bun run --filter @docs.plus/extension-<name> build`
3. **Preflight:** per package — `npm_config_user_agent=bun/1.3.14 bun run --filter @docs.plus/extension-<name> prepublishOnly`; all five — `bash scripts/extension-preflight.sh`
4. **Pack inspect (optional):** `cd extensions/extension-<name> && bun publish --dry-run` (lifecycle hooks use `bunx release-*`)
5. **Publish:** `cd extensions/extension-<name> && bun publish --tag latest --otp <6-digit>` — **Bun only**, not `npm publish` (`catalog:` peers)
6. **Tag:** `git tag '@docs.plus/extension-<name>@2.0.0'` then `git push origin '@docs.plus/extension-<name>@2.0.0'` — never `git push --tags`
7. **GitHub Release:** `gh release create '@docs.plus/extension-<name>@2.0.0' --notes "$(awk '/^## \[/{ if (found) exit; if (/^## \[2\.0\.0\]/) found=1 } found' extensions/extension-<name>/CHANGELOG.md)"`
8. **Discord:** fires from `.github/workflows/discord-release.yml` after the GitHub Release — one embed per package (five embeds if all ship the same day; accepted policy)
9. **Hyperlink only:** complete `4.3.0` unpublish/deprecate before or with `2.0.0` announce (see CHANGELOG Security section)

**Suggested cutover order:** hyperlink first (autolink partner for hypermultimedia), then hypermultimedia, indent, inline-code, placeholder.

## Docker build coverage

| Image                    | Extensions built in image                                                | Notes                                                                                    |
| ------------------------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `apps/webapp`            | All five + `floating-popover`                                            | Full `build-extensions` stage                                                            |
| `apps/hocuspocus.server` | hypermultimedia + inline-code (runtime); others stub `package.json` only | Migration imports only those two — indent/placeholder regressions do not fail this image |

## Maintainer tooling

Harness scripts, ports, `docs:screenshots`, and CI wiring: [extensions/README.md § Contributing](../../extensions/README.md#contributing).
