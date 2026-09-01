---
name: release-extensions
description: Publish or cut a release of the five @docs.plus/extension-* packages — package contract, release-family flow, OTP publish, version doctrine, preflight gates, and CHANGELOG style. Use when publishing, cutting a release, bumping an extension version, or preparing a CHANGELOG for npm.
---

# Releasing the `@docs.plus/extension-*` family

`RELEASE_POLICY.md` at the repo root is authoritative for versioning doctrine. Moved verbatim out of the repo-root [AGENTS.md](../../../AGENTS.md).

## Publishing And Releases

### Extension Package Contract

- Publish workspace extensions under the org-owned `@docs.plus` scope.
- `exports.require.types` must point to `./dist/index.d.cts`, not `.d.ts`.
- `sideEffects` must include CSS, e.g. `['**/*.css']`; do not use bare `false`.
- Every scoped package needs `publishConfig.access: "public"` or `bun publish` defaults to private and can 402.
- Package metadata should include `homepage`, `bugs`, and discovery-oriented `keywords`.
- **Public-facing docs follow the family install policy and stay cohesive.** Every `extensions/extension-*/README.md` and `CHANGELOG.md` uses Bun commands (`bun add` / `bun remove`), never `npm`/`yarn`/`pnpm` — even though external consumers could use npm. Install blocks show the plain `bun add <pkg>` line only. Add no `@next` soak lines, and never lead an Install block with `npm install <pkg>`. This mirrors `extensions/README.md`. Keep the five READMEs at structural parity: shared Install/Contributing/Family boilerplate, and a framework-neutral `new Editor` Quickstart from `@tiptap/core`, not React `useEditor`. Use no per-package marketing taglines, and no `chrome` in any prose (use "UI"/"shell"/"toolbar", same as the §Code Quality vocabulary rule).
- Extension publish audits expect all five packages at parity. Parity covers: package-local `CONTRIBUTING.md`, `bunx` release lifecycle hooks, README gallery assets via `docs:screenshots`, CI extension tests, and harness docs centralized in `extensions/README.md`. The gallery holds a hero plus `<details>`/`<picture>` scenes. Use no JS carousels. GitHub/npm READMEs are static HTML only. The cutover and e2e READMEs link to `extensions/README.md`, and do not duplicate its ports or scripts. Preview collapsible README galleries on GitHub or `bunx grip <readme>` — VS Code's default Markdown preview often won't render `<details>`/`<picture>`.
- Adding any root re-export through `src/index.ts` or `src/utils/index.ts` is a minor release, not a patch.
- Resolve `[Unreleased]` to a real version before `bun run build`, `bun pm pack`, and `bun publish`.
- `prepublishOnly` runs `release-preflight`; it asserts:
  - publisher user-agent is `bun/*`;
  - every `dist/...` path in the consumer's `exports` map exists on disk;
  - no literal `catalog:` leaks into built bundles.

### Release And Publish

- `RELEASE_POLICY.md` is authoritative for versioning doctrine, cutover phase, lockstep activation, `release:family`, CHANGELOG style, soak/promotion, CI guards, and readiness checklists. Bullets below are the operational subset agents need at the keyboard.
- Phase 1 cutover: each extension can ship its first `2.0.0` independently. Lockstep activates only through an explicit switch-flip commit in `AGENTS.md` / `RELEASE_POLICY.md`, not automatically when versions align.
- Lockstep release entry:

```bash
bun run release:family
```

The only root release/publish script is `"release:family": "bun scripts/release-family.ts"`. Do not reintroduce the removed `release`, `release:major`, `release:minor`, `release:patch`, `version*`, or parallel `publish` scripts.

- Publishing happens on the maintainer laptop because npm 2FA-on-write requires OTP. Do not put `NPM_TOKEN` in CI for publishing:

```bash
bun publish --tag latest --otp <6-digit>
```

- Releases are stable-only: every publish goes to the default `latest` tag when the maintainer decides it is ready. There is no `@next` dist-tag, no soak window, and no promotion step. `RELEASE_POLICY.md` §Release Readiness records that decision on 2026-07-07. The webapp already soaks every change from `workspace:*` source in production before npm sees it.
- Release tags are `<package-name>@<semver>` (e.g. `@docs.plus/extension-hyperlink@2.0.0`). `v<semver>` is reserved only as a fallback for future repo-wide releases.
- Release notes use the state-machine `awk` slice; the range form fails because both ends can match the same heading:

```bash
awk '/^## /{ if (found) exit; if (/^## \[<ver>\]/) found=1 } found' extensions/<pkg>/CHANGELOG.md
```

- Announcement happens after npm publish:
  - GitHub Releases are the announcement gate.
  - Discord `#github`: `secrets.DISCORD_GITHUB_WEBHOOK` via `.github/workflows/discord-activity.yml` (pushes) and `.github/workflows/discord-github.yml` (issues and pull requests).
  - Discord `#releases`: `secrets.DISCORD_RELEASES_WEBHOOK` via `.github/workflows/discord-release.yml`. The convention is one secret per channel, `DISCORD_<CHANNEL>_WEBHOOK`.
  - Release embeds: install hint is `bun add <pkg>@<version>`. The workflow's pre-release branch (orange embeds, `@next` hints) is dormant, because releases are stable-only. Leave it in place, and do not exercise it. Do not hard-code per-package paths in the workflow.

### Extension Version Doctrine

- All five publishable `@docs.plus/extension-*` packages share the same major, tracking the docs.plus product line.
- `1.x` = 2023 product line.
- `2.x` = docs.plus alpha v2.
- Extensions are leaf packages; lockstep is policy, not graph-forced.
- Rotating per-package cutover state lives in [`.cursor/docs/extension-version-cutover.md`](../../docs/extension-version-cutover.md) and is deleted with the lockstep switch-flip PR.
- Family-release script invariants in `scripts/release-family.ts`:
  - Use `spawnSync` helper calls, no shell strings, so the OTP stays off the shell command line and out of shell history. The spawned `bun publish` still carries it in its own argv, so `ps` can read it for the life of that child.
  - GitHub release creation is idempotent across resumes: iterate `[...published, ...skipped]` and guard each with `gh release view <tag>`.
  - Push an explicit tag list only. Never run `git push --tags`.
- CLI flags: `--dry-run`, `--allow-noop`, `--generate-noop-changelogs`, `--help`. Publishes always target the default `latest` tag; the former `--tag <next|latest>` flag was removed with the stable-only decision.
- Preflight aggregates errors before any OTP prompt:
  1. lockstep;
  2. CHANGELOG entries;
  3. `dist/` freshness against `src/`;
  4. per-package `prepublishOnly`;
  5. clean working tree and `HEAD` matches `origin/main`;
  6. `npm whoami` and `git user.email`;
  7. local and remote tag collisions — except a local tag on `HEAD` whose version is already on npm, which a previous run wrote;
  8. no-op detection via `git diff <prevTag>..HEAD -- extensions/<pkg>/src/`.
- CHANGELOG style guide — prose follows the [Simplified English house standard](../tech-writer/SKILL.md#simplified-english-house-standard):
  - Themed sections per major: Highlights, Breaking, Added, Changed, Fixed, Security, Removed, Documentation, Internal.
  - Include code-diff migration guides and one-shot rename scripts for mechanical changes.
  - Disclose mispublishes/unpublishes honestly.
  - Add a brief pre-X.0 development history when public versions diverge from internal milestones.
  - Never auto-generate entries from commit subjects. Lerna/Changesets/Release-Please are not adopted.
