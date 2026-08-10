# Release Policy

This document defines how the `@docs.plus/extension-*` package family is versioned, published, and announced. It is the authoritative reference; the `release-extensions` skill (`.cursor/skills/release-extensions/SKILL.md`) carries the operational subset and points here.

## Status

| Field                      | Value                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Doctrine                   | **Strict lockstep, Tiptap-style** — all 5 publishable extensions share one major                            |
| Major tracks               | The **docs.plus product line** (`1.x` = 2023 product, `2.x` = alpha v2)                                     |
| Current phase              | **Phase 1 — Cutover.** Each extension ships its `2.0.0` independently                                       |
| npm state                  | 3 of 5 already published under older lines; 2 never published — see [Phase 1](#phase-1--cutover-current)    |
| Trigger to flip to Phase 2 | **Trigger D** — see [Trigger D](#trigger-d--when-strict-lockstep-activates)                                 |
| Publish gate               | **Release when ready** — see [Release Readiness](#release-readiness); stable only, no pre-release dist-tags |

The five publishable packages:

- `@docs.plus/extension-hyperlink`
- `@docs.plus/extension-hypermultimedia`
- `@docs.plus/extension-indent`
- `@docs.plus/extension-inline-code`
- `@docs.plus/extension-placeholder`

`@docs.plus/webapp` and `@docs.plus/hocuspocus.server` consume these via `workspace:*` and have their own independent version lines. They are **not** part of the lockstep family.

## Versioning Doctrine

**Strict lockstep.** All five publishable extensions ship at the same `MAJOR.MINOR.PATCH` once Phase 2 begins. When any one of them needs a release at version `X`, all five publish at `X`. Packages with no behavioral changes ship a no-op release (see [No-op releases](#no-op-releases)).

**Major tracks the product.** The major number aligns with the docs.plus product line, not with each extension's individual API churn. This is the React / Vue / Angular / Tiptap pattern: one platform, one major.

**Why lockstep over independent versions.** The extensions are pieces of one platform that happens to be open source. Webapp consumes all of them; the platform's identity is a single version, not a five-tuple. Lockstep eliminates the matrix-compatibility question ("does `extension-hyperlink@2.3.0` work with `extension-indent@1.4.0`?") for every consumer, including webapp itself.

**What lockstep is not.** It is **not** a guarantee that every release contains a real change in every package. It **is** a guarantee that any two extensions at the same version were tested and shipped together.

## Phase 1 — Cutover (current)

**Goal:** get all five extensions to `2.0.0` on npm, each on its own schedule.

**Starting state.** `extension-hyperlink`, `extension-hypermultimedia`, and `extension-indent` already serve an older version as `latest`; for those three, `2.0.0` moves `latest` forward. `extension-inline-code` and `extension-placeholder` have never been published, so `2.0.0` is their first release of any version. The [cutover tracker](.cursor/docs/extension-version-cutover.md) holds the per-package numbers and is the file to update as each one ships.

**Rules during Phase 1:**

1. Each extension's `package.json` `version` is bumped to `2.0.0` independently when its breaking changes are ready.
2. Each ships per the existing per-package runbook in the `release-extensions` skill: `bun publish --tag latest --otp <code>` → `git tag <pkg>@2.0.0` → `gh release create ...`.
3. Each carries its own `[2.0.0]` `CHANGELOG.md` entry following the [CHANGELOG style guide](#changelog-style-guide).
4. Each must have the publishable-package scaffolding before its first `2.0.0` ship. See [Per-package readiness checklist](#per-package-readiness-checklist).
5. **No CI guard enforces version alignment.** The workflow has never been written, so no PR is blocked for non-aligned versions during cutover. See [CI Guard](#ci-guard).

**Order of cutover:**

1. `extension-hyperlink@2.0.0` — first.
2. The other four — over coming windows, no fixed schedule, in whatever order maturity allows.

All five already carry `"version": "2.0.0"` in `package.json` and a `## [2.0.0]` CHANGELOG entry. What still gates each ship is the [readiness checklist](#per-package-readiness-checklist), not the version bump.

**Honest disclosure.** `@docs.plus/extension-hyperlink@4.3.0` was published to npm by mistake on 2026-04-19, on a semver line the package never had. npm's unpublish window is 72 hours, so it closed on 2026-04-22: `4.3.0` cannot be removed. It **is already deprecated**, but with npm's generic string — the registry returns `"deprecated": "this package has been deprecated"`, which tells an installer nothing about what to use instead.

That still matters after `2.0.0` ships, because `4.3.0` outranks every other published version by semver. It stays at the top of the registry's version list even once `latest` points at `2.0.0`. Re-running `npm deprecate` overwrites the message, so the remaining action is to replace the generic one:

```bash
npm deprecate '@docs.plus/extension-hyperlink@4.3.0' 'Mispublished by mistake — not a real release. Install 2.x instead.'
```

Verify with `npm view '@docs.plus/extension-hyperlink@4.3.0' deprecated`. `npm deprecate` is a registry operation, not package management, so the Bun-only rule does not apply. It is a write, so npm 2FA may ask for `--otp`. Run it from the maintainer laptop with the npm login used to publish.

The `[2.0.0]` CHANGELOG entry is the consumer-facing disclosure and must state the same outcome. Future cutover entries follow the same honesty norm.

## Trigger D — When Strict Lockstep Activates

Lockstep is **not** auto-derived. It activates the moment **both** of the following hold:

- **Family alignment:** all five publishable extensions are at the same major version on npm (i.e. all five have shipped a `2.x`).
- **Deliberate switch-flip:** an explicit commit lands on `main` that updates this section of `RELEASE_POLICY.md` from "Phase 1 — Cutover" to "Phase 2 — Lockstep active". The same commit adds the CI guard described in [CI Guard](#ci-guard).

The deliberate-commit gate is intentional. Family alignment alone is not enough — the maintainer must affirm that the family is ready for coordinated releases. This prevents lockstep from accidentally engaging the moment the fifth `2.0.0` lands while the team is still treating it as a per-package release.

Until the switch-flip commit lands, the CI guard does not exist and nothing is binding.

## Phase 2 — Steady State

**Goal:** ship coordinated minor and patch releases of the family with one script invocation.

### The release script — `bun run release:family`

The script orchestrates the five-package OTP rhythm and batches the post-publish work. It is implemented as the Bun script [`scripts/release-family.ts`](scripts/release-family.ts) and wired as the root script `release:family`; the sections below describe what it does today.

It reads the package list from [`scripts/publishable-extensions.ts`](scripts/publishable-extensions.ts) — the same SSOT the test gates use — and takes the target version from the packages themselves. Flags: `--dry-run` (run every check, print the plan, never publish or tag), `--allow-noop`, `--generate-noop-changelogs`, `--help`. There is no dist-tag flag; every publish goes to `latest` (see [Release Readiness](#release-readiness)).

#### Pre-flight (all checks before any OTP)

Every check runs before any prompt. Failures are collected and reported together, not one per run:

1. **Lockstep:** every publishable package's `package.json` carries the same `version`. That version is the target.
2. **CHANGELOG entry:** each package's `CHANGELOG.md` contains a `## [<target-version>]` heading.
3. **Build freshness:** each package has a non-empty `dist/`, and no file under `src/` is newer than the newest file under `dist/`. The script never builds — a stale `dist/` is an error to fix, not something it repairs.
4. **Per-package preflight:** each package's `prepublishOnly` is `bunx release-preflight` (delegated to `@docs.plus/release-tooling`) and passes. It asserts `bun/*` user-agent, no `catalog:` leaks in built bundles, and dist artifacts derived from the consumer's `exports` map all present.
5. **Git state:** working tree is clean; HEAD matches `origin/main`.
6. **Identity:** `npm whoami` returns a user; `git config user.email` is set.
7. **Tag collision:** none of the planned tags `<pkg>@<target-version>` already exist locally or on the remote. One exception keeps a resumed run from failing on its own tags. A local tag that points at `HEAD` **and** whose version is already on npm was written by the previous run. The script accepts that tag. Both conditions must hold, or a genuine re-release would be masked. A tag on the remote is always an error. The script pushes tags only after the whole publish loop, so a mid-loop failure never leaves one there.
8. **No-op intentionality:** the previous version is the last entry of `npm view <pkg> versions` other than the target, and `git diff '<pkg>@<prev>'..HEAD -- extensions/<pkg>/src/` decides. An empty diff marks a no-op and requires an explicit `--allow-noop` flag. A package with no published versions, or with no local git tag for its previous version, is skipped by this check. (No-op releases are expected — see [No-op releases](#no-op-releases) — but should be intentional.)

If anything fails, **no OTP is requested** and the script exits non-zero.

#### Publish loop

Packages run in the order declared by `scripts/publishable-extensions.ts`; there are no inter-extension deps to topologically order today. Before the loop, the script prints the target and asks for a `y/N` confirmation. `--dry-run` skips that confirmation, and stops short of every publish, tag, and push.

For each package:

1. Call `npm view <pkg>@<target-version>` to detect "already published" (the resume case after a mid-stream failure). If already published, skip the publish and create the local tag if it is missing.
2. Prompt for OTP. Input must be 6–8 digits.
3. Run `bun publish --tag latest --otp <code>`.
4. Run `git tag '<pkg>@<target-version>'`.

On `bun publish` failure: halt immediately, do not retry (would burn an OTP), print `Resume with: bun run release:family`. Already-published packages stay published — npm has no transactional multi-publish.

#### Post-publish (batched)

1. `git push origin <tag> <tag> …` — one call with the explicit tag list. Never `git push --tags` (AGENTS.md §Release Safety).
2. For each package, `gh release create '<pkg>@<target-version>' --title '<pkg>@<target-version>' --notes-file <slice from CHANGELOG.md>`. The script slices the entry itself and guards each release with `gh release view`, so a resumed run does not fail on releases that already exist. The `awk` slice in the `release-extensions` skill is the equivalent for the manual Phase 1 runbook.
3. Print summary: target version, published count, skipped count, and one npm URL per package.

The existing `discord-release.yml` workflow fires per release event, so the team gets five Discord embeds in ~30 seconds. This is accepted noise. Each embed carries its own changelog and install hint. The cadence is a few times per year, so it does not warrant inventing an umbrella-release format. See [Decision: per-package releases over umbrella](#decision-per-package-releases-over-umbrella).

### Coordinated semver during Phase 2

- **Patch (`2.1.3`):** any package needs a bug fix → all five ship `2.1.3`.
- **Minor (`2.2.0`):** any package adds a re-exported symbol or any other backward-compatible feature → all five ship `2.2.0`.
- **Major (`3.0.0`):** any package introduces a breaking change, **or** the docs.plus product line itself bumps to a new major → all five ship `3.0.0`.

The product-line major bump is the strongest case: `webapp@3.0.0` ships → all extensions go to `3.0.0` regardless of whether their own APIs changed.

### No-op releases

When a package has no behavioral changes since its previous release but ships in a coordinated family release anyway, it gets an auto-generated CHANGELOG entry:

```markdown
## [<version>] — <date>

Aligned to docs.plus <version> family release. No behavioral changes since <prev-version>.
```

`bun run release:family --generate-noop-changelogs` writes this entry verbatim for every package the no-op detection finds (git diff `<prev-tag>..HEAD -- extensions/<pkg>/src/` empty) and then exits without publishing. The maintainer reviews and commits the generated entries, then re-runs the script; preflight check #2 verifies they exist. The flag refuses to run while lockstep is violated, since the target version would be ambiguous.

## CHANGELOG Style Guide

Set by the `extension-hyperlink@2.0.0` rewrite. Applies to every publishable extension.

**Voice:** entry prose follows [Simplified English](.cursor/skills/tech-writer/SKILL.md#simplified-english-house-standard). The section headings below are exempt from it. A published entry is frozen against fact changes: its facts, versions, dates, headings, and ordering never change. Only a maintainer-approved prose pass may reshape its sentences.

**Format:** [keepachangelog.com](https://keepachangelog.com).

**Per-release section ordering, omit empty subsections:**

```markdown
## [X.Y.Z] — YYYY-MM-DD

### Highlights (mandatory for major/minor; optional for patch)

### Breaking / Breaking Changes (presence implies a Migration section)

Published entries use the shorthand `### Breaking` (same meaning as `Breaking Changes`). New entries may use either heading; do not rename shipped headings for style-only churn.

### Added

### Changed

### Fixed

### Security

### Removed

### Documentation

### Internal
```

**Highlights bullet style:** 3–6 bullets, each a complete sentence, each calling out a user-facing capability with a concrete name (`normalizeHref`, `SpecialUrlType`, etc.). The `extension-hyperlink@2.0.0` Highlights block is the template.

**Migration section:** required if and only if there's a Breaking Change. Inside it: a one-shot rename script for the mechanical changes (where applicable), plus before/after code diffs for each break.

**Honest disclosure:** disclose mispublishes, unpublishes, deprecations, and version-line resets in the CHANGELOG. Put each one in the entry where it happened. Use a "Pre-X.0 development history" appendix instead when public versions diverged from internal milestones. That appendix is a one-time artifact, not a recurring section.

**Never auto-generate from commit subjects.** Lerna, Changesets, and Release-Please all default to "extract `fix:` / `feat:` lines from commit messages and stitch them together". This produces low-quality changelogs that undercut the editorial bar set by `extension-hyperlink@2.0.0`. The manual editorial process **is** the policy. None of those tools are adopted.

## Release Readiness

**Release when ready.** There is no pre-release dist-tag, no soak window, and no promotion step. Every publish goes to the default `latest` tag. It happens when the maintainer decides the package (Phase 1) or the family (Phase 2) is ready. Ready typically means the change set is complete, the readiness checklist and preflight pass, and the CHANGELOG entry is written. Bump the version, publish, done.

**Why this is safe without a soak.** The webapp consumes the extensions via `workspace:*`. So every change ships to docs.plus production from source well before it is ever published to npm. Production exposure precedes the registry, not the reverse. The quality gates are the per-package test suites, `release-preflight`, and the readiness checklist below, not a waiting period.

**If third-party consumption at scale ever demands staged rollouts,** revisit this section then — that would be the moment a pre-release channel justifies its cost.

**Discord announcements.** Each package release triggers one embed via `discord-release.yml`. A same-day five-package release produces five embeds in sequence — intentional (per-package install hints). No umbrella family release is planned.

## CI Guard

**The guard has never been written.** Nothing in `.github/workflows/` checks extension version alignment, and no PR is blocked for non-aligned versions today. The [Trigger D](#trigger-d--when-strict-lockstep-activates) switch-flip commit must author the workflow from scratch — it is part of that commit, not a separate step. The spec below is the contract that commit must satisfy.

**Location:** `.github/workflows/lockstep-guard.yml` — not implemented; the Trigger D commit creates it.

**Trigger:** any PR that touches `extensions/extension-*/package.json`.

**Check:** parse the `version` field of all five publishable extensions. If they are not all identical, the PR fails with a clear message:

```text
Lockstep violated: extension-X is at 2.1.0 but extension-Y is at 2.0.3.
All publishable extensions must share a version.
See RELEASE_POLICY.md "Versioning Doctrine".
```

**Bypass:** add the label `lockstep-bypass` to the PR. Reserved for the rare hotfix that legitimately ships outside the family — should be near-zero in practice.

**Activation:** the Trigger D commit creates the workflow already active (`if: true`) — there is no earlier dormant/`if: false` state to flip. No retroactive enforcement, no PR breakage during cutover.

## Per-package Readiness Checklist

Before any extension ships its `2.0.0` (and joins the eventual lockstep family), it needs the publishable-package scaffolding. The checklist applies to all five, including the three that already have older versions on npm. An existing npm listing is not evidence that the current scaffolding is in place:

- [ ] `LICENSE` in `.gitignore` (root `LICENSE` is the single source of truth; `prepack` regenerates it before each pack)
- [ ] `"@docs.plus/release-tooling": "workspace:*"` in `devDependencies`
- [ ] `"prepack": "bunx release-prepack"` in `package.json` (copies root `LICENSE` into the package via the shared bin)
- [ ] `"prepublishOnly": "bunx release-preflight"` in `package.json` (asserts `bun/*` user-agent, no `catalog:` leaks, dist artifacts present — derived from the consumer's `exports` map)
- [ ] `publishConfig.access: "public"` in `package.json`
- [ ] `exports.require.types` points to `./dist/index.d.cts` (not `.d.ts`)
- [ ] `sideEffects: ['**/*.css']` (not bare `false`) if the package ships any CSS
- [ ] `homepage`, `bugs`, and discovery-oriented `keywords` populated in `package.json`
- [ ] `[2.0.0]` `CHANGELOG.md` entry following the [style guide](#changelog-style-guide)
- [ ] Release-gate tests passing — hyperlink: `bun test src` + Cypress; indent: Jest + Cypress; hypermultimedia / inline-code / placeholder: clean-room Cypress against `dist/`
- [ ] `bun pm pack` dry-run produces a clean tarball

The `extension-hyperlink` package is the reference shape — when wiring a new extension, copy from there. **Never copy the `prepack` / `preflight` script bodies into per-package `scripts/` directories**; the canonical implementation lives in `@docs.plus/release-tooling` and is consumed via the bin commands above. Same DRY principle as `@docs.plus/eslint-config`, `tsconfig.base.json`, and `tsup.base.ts`.

## Decisions Recorded

These are the explicit decisions made during the policy design session. Each is locked in; revisiting requires updating this document.

### Decision: Skip the umbrella git tag

The five per-package tags collectively pin the source state (lockstep means they all point to the same commit). An additional `docs.plus-family@<version>` umbrella tag would be redundant. It would add one more tag-management thing to think about, and no existing infrastructure would consume it. Skipped.

### Decision: Per-package releases over umbrella

The Discord workflow fires per `release.{published,prereleased}` event with package-specific embeds (color-coded by stability, install hint per package). Five releases means five Discord embeds in ~30 seconds. Inventing an umbrella-release format would mean rewriting the Discord workflow and losing per-package install hints. For a few-times-per-year event, one minute of Discord noise is fine. Per-package releases retained.

### Decision: Auto-generate no-op CHANGELOG entries

No-op CHANGELOG entries are pure boilerplate (one fixed sentence). Auto-generating them removes 4× the typing burden per family release and removes the "I forgot to write the no-op entry" failure mode. The script generates them; the maintainer commits them before publish; preflight check #2 verifies they exist. Adopted.

### Decision: Stable releases only — no pre-release dist-tags (2026-07-07)

Supersedes the earlier "webapp-gated soak" decision. `@next` was retired before anything was ever published to it. The webapp already soaks every change from `workspace:*` source in production. A registry-side pre-release channel therefore added process without adding signal. Publishes go straight to `latest` when the maintainer decides they are ready; GitHub releases are never marked pre-release. See [Release Readiness](#release-readiness).

### Decision: No release-automation tooling

Lerna, Changesets, and Release-Please all default to commit-message-driven changelog generation, which undercuts the editorial bar this policy demands. Manual changelog authorship is the policy. The `bun run release:family` script orchestrates the OTP rhythm and batches post-publish work; it does not author content.
