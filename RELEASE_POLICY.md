# Release Policy

This document defines how the `@docs.plus/extension-*` package family is versioned, published, and announced. It is the authoritative reference; `AGENTS.md` carries a short pointer to here.

## Status

| Field                      | Value                                                                            |
| -------------------------- | -------------------------------------------------------------------------------- |
| Doctrine                   | **Strict lockstep, Tiptap-style** — all 5 publishable extensions share one major |
| Major tracks               | The **docs.plus product line** (`1.x` = 2023 product, `2.x` = alpha v2)          |
| Current phase              | **Phase 1 — Cutover.** Each extension ships its first `2.0.0` independently      |
| Trigger to flip to Phase 2 | **Trigger D** — see [Trigger D](#trigger-d--when-strict-lockstep-activates)      |
| Promotion gate             | **Webapp-gated soak** — see [Soak window](#soak-window-and-promotion-criteria)   |

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

**Goal:** get all five extensions to `2.0.0` on npm `@next`, each on its own schedule.

**Rules during Phase 1:**

1. Each extension's `package.json` `version` is bumped to `2.0.0` independently when its breaking changes are ready.
2. Each ships per the existing per-package runbook in `AGENTS.md` ("Release routine"): `bun publish --tag next --otp <code>` → `git tag <pkg>@2.0.0` → `gh release create ... --prerelease`.
3. Each carries its own `[2.0.0]` `CHANGELOG.md` entry following the [CHANGELOG style guide](#changelog-style-guide).
4. Each must have the publishable-package scaffolding before its first `2.0.0` ship. See [Per-package readiness checklist](#per-package-readiness-checklist).
5. **The CI lockstep guard is dormant in Phase 1.** No PR is blocked for non-aligned versions during cutover.

**Order of cutover:**

1. `extension-hyperlink@2.0.0` — first, this week. Already prepared.
2. The other four — over coming windows, no fixed schedule, in whatever order maturity allows.

**Honest disclosure.** The `extension-hyperlink@4.3.0` mispublish is being unpublished within npm's 72-hour window (`npm unpublish` requires `<72h after publish AND no public dependents`). If that window closes first, fall back to `npm deprecate`. The `[2.0.0]` CHANGELOG already discloses this; future cutover entries follow the same honesty norm.

## Trigger D — When Strict Lockstep Activates

Lockstep is **not** auto-derived. It activates the moment **both** of the following hold:

- **Family alignment:** all five publishable extensions are at the same major version on npm (i.e. all five have shipped a `2.x`).
- **Deliberate switch-flip:** an explicit commit lands on `main` that updates this section of `RELEASE_POLICY.md` from "Phase 1 — Cutover" to "Phase 2 — Lockstep active", and flips the CI guard from `if: false` to `if: true` in the same commit.

The deliberate-commit gate is intentional. Family alignment alone is not enough — the maintainer must affirm that the family is ready for coordinated releases. This prevents lockstep from accidentally engaging the moment the fifth `2.0.0` lands while the team is still treating it as a per-package release.

When the switch-flip commit lands, the CI guard becomes binding for every subsequent PR.

## Phase 2 — Steady State

**Goal:** ship coordinated minor and patch releases of the family with one script invocation.

### The release script — `bun run release:family`

The script orchestrates the five-package OTP rhythm and batches the post-publish work. It is a Bun script in `scripts/release-family.ts`; the implementation is deferred until Phase 2 is imminent, but the spec below is the contract.

#### Pre-flight (all checks before any OTP)

The script halts with a clear error message if any of these fail:

1. **Lockstep:** every `packages/extension-*/package.json` has the same `version` (the target version).
2. **CHANGELOG entry:** each package's `CHANGELOG.md` contains a `## [<target-version>]` section.
3. **Build freshness:** each package's `dist/` exists and `mtime` is newer than its `src/`. (Or: the script runs `bun run build` per package as part of preflight.)
4. **Per-package preflight:** each package's existing `scripts/preflight.ts` passes (asserts `bun/*` user-agent, no `catalog:` leaks in built bundles, dist artifacts present).
5. **Git state:** working tree is clean; HEAD matches `origin/main`; no unpushed commits.
6. **Identity:** `npm whoami` matches the expected user; `git config user.email` matches.
7. **Tag collision:** none of the planned tags `<pkg>@<target-version>` already exist locally or on the remote.
8. **No-op intentionality:** for any package whose `dist/` is byte-identical to its previously published version (`npm view <pkg>@<prev> dist.tarball`), require an explicit `--allow-noop` flag. (No-op releases are expected — see [No-op releases](#no-op-releases) — but should be intentional.)

If anything fails, **no OTP is requested** and the script exits non-zero.

#### Publish loop

For each package, in alphabetical order (no inter-extension deps to topologically order today):

1. Call `npm view <pkg>@<target-version>` to detect "already published" (the resume case after a mid-stream failure). If already published, skip and move to the next package.
2. Prompt for OTP.
3. Run `bun publish --tag <next|latest> --otp <code>`.
4. Run `git tag '<pkg>@<target-version>'`.

On `bun publish` failure: halt immediately, do not retry (would burn an OTP), print `Resume with: bun run release:family`. Already-published packages stay published — npm has no transactional multi-publish.

#### Post-publish (batched)

1. `git push origin --tags` (one call, all five new tags).
2. For each package, `gh release create '<pkg>@<target-version>' --notes <slice from CHANGELOG.md> [--prerelease]` using the existing `awk` slice from `AGENTS.md`. The `--prerelease` flag derives from the `--tag next` choice at script start.
3. Print summary: 5 npm URLs, 5 GitHub release URLs.

The existing `discord-release.yml` workflow fires per release event, so the team gets five Discord embeds in ~30 seconds. This is accepted noise; each embed carries its own changelog and install hint, and the cadence (a few times per year) does not warrant inventing an umbrella-release format. See [Decision: per-package releases over umbrella](#decision-per-package-releases-over-umbrella).

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

The script generates this verbatim during preflight check #2 (CHANGELOG entry) for any package missing an entry where the git diff `<prev-tag>..HEAD -- packages/<pkg>/src/` is empty. The maintainer commits the auto-generated entries before re-running the script.

## CHANGELOG Style Guide

Set by the `extension-hyperlink@2.0.0` rewrite. Applies to every publishable extension.

**Format:** [keepachangelog.com](https://keepachangelog.com).

**Per-release section ordering, omit empty subsections:**

```markdown
## [X.Y.Z] — YYYY-MM-DD

### Highlights (mandatory for major/minor; optional for patch)

### Breaking Changes (presence implies a Migration section)

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

**Honest disclosure:** mispublishes, unpublishes, deprecations, version-line resets — all disclosed in the CHANGELOG, in the entry where they happened or in a "Pre-X.0 development history" appendix when public versions diverged from internal milestones (one-time artifact, not a recurring section).

**Never auto-generate from commit subjects.** Lerna, Changesets, and Release-Please all default to "extract `fix:` / `feat:` lines from commit messages and stitch them together". This produces low-quality changelogs that undercut the editorial bar set by `extension-hyperlink@2.0.0`. The manual editorial process **is** the policy. None of those tools are adopted.

## Soak Window and Promotion Criteria

**Webapp-gated promotion.** The `@next` → `@latest` promotion has no fixed time window. Promotion happens after `webapp` has shipped a stable production release that consumes the new family version, and that release has been live for at least 48 hours with no rollback.

**Concretely:**

1. Family release ships to `@next`.
2. Webapp upgrades to the new family version on a feature branch.
3. Webapp's own release process ships a stable production release containing the new family version.
4. After 48 hours of stable webapp production with no rollback, the maintainer promotes each extension via `npm dist-tag add <pkg>@<version> latest`.
5. Each promotion is a separate `npm dist-tag` call (5 calls total). No batching script is needed for this step — promotion is rare and deliberate.

**Why webapp-gated, not time-gated.** The platform-first framing means the extensions are ready when the platform says they're ready. A pure 7-day timer is arbitrary; "webapp shipped it stably" is a real signal driven by real users hitting real production traffic.

**Why this changes later.** The moment a third party starts consuming any extension at scale, the policy shifts to a time-based or hybrid gate — third parties cannot wait on webapp's release schedule. This document gets updated then.

## CI Guard

A GitHub Action enforces the lockstep invariant in Phase 2.

**Location:** `.github/workflows/lockstep-guard.yml`.

**Trigger:** any PR that touches `packages/extension-*/package.json`.

**Check:** parse the `version` field of all five publishable extensions. If they are not all identical, the PR fails with a clear message:

```text
Lockstep violated: extension-X is at 2.1.0 but extension-Y is at 2.0.3.
All publishable extensions must share a version.
See RELEASE_POLICY.md "Versioning Doctrine".
```

**Bypass:** add the label `lockstep-bypass` to the PR. Reserved for the rare hotfix that legitimately ships outside the family — should be near-zero in practice.

**Phase 1 behavior:** the workflow file exists with `if: false` at the top. The Trigger D switch-flip commit flips it to `if: true` in the same commit. No retroactive enforcement, no PR breakage during cutover.

## Per-package Readiness Checklist

Before any extension ships its first `2.0.0` (and joins the eventual lockstep family), it needs the publishable-package scaffolding currently wired only on `extension-hyperlink`:

- [ ] `LICENSE` in `.gitignore` (root `LICENSE` is the single source of truth)
- [ ] `scripts/prepack.ts` that copies the root `LICENSE` into the package directory
- [ ] `"prepack": "bun run scripts/prepack.ts"` in `package.json`
- [ ] `scripts/preflight.ts` that asserts `bun/*` user-agent, no `catalog:` leaks, dist artifacts present
- [ ] `"prepublishOnly": "bun run scripts/preflight.ts"` in `package.json`
- [ ] `publishConfig.access: "public"` in `package.json`
- [ ] `exports.require.types` points to `./dist/index.d.cts` (not `.d.ts`)
- [ ] `sideEffects: ['**/*.css']` (not bare `false`) if the package ships any CSS
- [ ] `homepage`, `bugs`, and discovery-oriented `keywords` populated in `package.json`
- [ ] `[2.0.0]` `CHANGELOG.md` entry following the [style guide](#changelog-style-guide)
- [ ] Bun-native unit tests (`bun test src`) passing — distinct from the Jest stack used by `extension-indent` and webapp
- [ ] `bun pm pack` dry-run produces a clean tarball

The `extension-hyperlink` package is the reference — when wiring a new extension, copy from there.

## Decisions Recorded

These are the explicit decisions made during the policy design session. Each is locked in; revisiting requires updating this document.

### Decision: Skip the umbrella git tag

The five per-package tags collectively pin the source state (lockstep means they all point to the same commit). An additional `docs.plus-family@<version>` umbrella tag would be redundant, would add one more tag-management thing to think about, and would not be consumed by any existing infrastructure. Skipped.

### Decision: Per-package releases over umbrella

The Discord workflow fires per `release.{published,prereleased}` event with package-specific embeds (color-coded by stability, install hint per package). Five releases means five Discord embeds in ~30 seconds. Inventing an umbrella-release format would mean rewriting the Discord workflow and losing per-package install hints; for a few-times-per-year event, one minute of Discord noise is fine. Per-package releases retained.

### Decision: Auto-generate no-op CHANGELOG entries

No-op CHANGELOG entries are pure boilerplate (one fixed sentence). Auto-generating them removes 4× the typing burden per family release and removes the "I forgot to write the no-op entry" failure mode. The script generates them; the maintainer commits them before publish; preflight check #2 verifies they exist. Adopted.

### Decision: Webapp-gated soak, not time-based

See [Soak window and promotion criteria](#soak-window-and-promotion-criteria) for rationale.

### Decision: No release-automation tooling

Lerna, Changesets, and Release-Please all default to commit-message-driven changelog generation, which undercuts the editorial bar this policy demands. Manual changelog authorship is the policy. The `bun run release:family` script orchestrates the OTP rhythm and batches post-publish work; it does not author content.
