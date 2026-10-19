---
name: release-product
description: Cut a docs.plus product release end to end — rulings, changelogs, version bumps, docs sync, the GitHub Release note, the release banner, the demo page and the ship order. Use when the maintainer asks to prepare, review or ship a new docs.plus version, or runs the release-product workflow.
---

# Releasing docs.plus

This is the playbook from the v2.1.0 release (2026-10-13). It covers every step that took a day of back and forth.
`RELEASE_POLICY.md` stays authoritative for versioning. The [`release-extensions`](../release-extensions/SKILL.md) skill owns the npm side.

## How to run it

The saved workflow `.claude/workflows/release-product.js` drives the agents. Run it in two passes.

1. **Plan pass.** `Workflow({ name: 'release-product' })` with no args. It gathers the facts and returns the open rulings. Ask the maintainer those rulings with `AskUserQuestion`, one batch, with a recommended option first.
2. **Draft pass.** Run it again with `resumeFromRunId` of the plan pass, so the facts come from cache. Agents write every file in parallel, other agents verify each one, and a readiness panel gives a verdict. Pass this exact shape:

   ```js
   args: {
     version: '2.2.0',
     date: '2026-11-20',
     base: '38f06c6bc', // optional; pass it in both passes or in neither
     decisions: {
       version: '2.2.0',
       knownGaps: 'ship #457, named in the hocuspocus Security section',
       publishExtensions: true, // required boolean; the workflow stops without it
       extensionBehaviour: 'ship with migration notes',
       commitPolicy: 'agents commit nothing'
     }
   }
   ```

3. **Main loop.** The workflow cannot use the Artifact tool or the browser, so the main loop builds the banner and runs the browser checks (sections 5, Demo page, and 6, Banner).
4. **Hand over.** Leave every change uncommitted. The maintainer reviews by hand, then runs §Ship.

## Rulings to ask every release

Never decide these alone. Each one changed the v2.1.0 work.

- **Version.** The product version lives in `apps/webapp` and `apps/hocuspocus.server`. `apps/admin-dashboard` keeps its own version. Breaking self-host changes still shipped as a minor in 2.1.0, with one SemVer-exception sentence.
- **Known gaps.** Ship with an open security or data issue, or block? If it ships, it goes in the hocuspocus CHANGELOG Security section and on the issue. It never goes in the release note.
- **Extensions.** Publish the `@docs.plus/extension-*` packages? Check `git diff <base>..HEAD --name-only -- 'extensions/*/src/**'`. From Phase 2 on they move together (lockstep).
- **Behaviour changes in extensions.** Ship them in this release with migration notes, or hold them?
- **Commit policy.** Default: agents commit nothing. The maintainer reviews every change by hand.

## Facts to gather

- **Base commit.** The last product release commit, not the last tag. On 2.1.0 the base was `38f06c6bc`, because the `v2.0.1` tag is not an ancestor of `main`. Never build a compare link from a tag that is not an ancestor.
- **Numbers.** Count from the base only:
  - commits: `git rev-list --count <base>..HEAD`;
  - feature, fix and docs commits, by conventional prefix;
  - issues closed since the base date: `gh issue list --state closed --search "closed:>=<date>"`, split by the `bug` and `Security` labels;
  - test count from the last green `check:ci` output;
  - Supabase migrations added under `packages/supabase/migrations/`.
- **Changed packages.** Which `package.json` files must move, and which extension `src/` trees changed.
- **Headline features.** Read the closed issues and the commits. Ask the maintainer which UI items to show; on 2.1.0 the Find bar and the Share card QR code were missed until they sent screenshots.

## Artifacts and their rules

Every prose file follows the [tech-writer](../tech-writer/SKILL.md) skill and Simplified English.

### 1. Changelogs

- Root `CHANGELOG.md`, `apps/webapp/CHANGELOG.md`, `apps/hocuspocus.server/CHANGELOG.md`, and each extension that moves.
- Keep an empty `## [Unreleased]` heading above the new `## [X.Y.Z] — YYYY-MM-DD` entry.
- Sections: Highlights, Breaking, Migration, Added, Changed, Fixed, Security, Removed, Internal. Link each item to its issue.
- The root entry carries an extensions outline and the UI and UX improvements. The maintainer counts those as proof that the product improves.
- The hocuspocus entry carries the full self-host Migration checklist: new env vars, migrations, backfills. A missing env var once held every email.
- Never auto-generate entries from commit subjects.

### 2. Versions and lockfile

Bump the product packages, and the extensions if they publish. Run `bun install`, then confirm `bun install --frozen-lockfile` passes. Commit `bun.lock` with the bumps.

### 3. Docs sync

Check every page the release makes wrong: `README.md` (extension status), `extensions/README.md`, `docs/self-hosting/install.md` (step 1 points at the new tag), `RELEASE_POLICY.md` when a phase changes, and `AGENTS.md` router rows.

### 4. Release note

- File: RELEASE-NOTES.md in `Notes/` under a `release-X.Y.Z` folder (gitignored). It becomes the GitHub Release body.
- Use the [launch](../launch/SKILL.md) skill, mainly `references/shipped-changes.md`: outcome first ("You can now…"), major, medium and minor tiers, numbers only from the change.
- Use the approved warm tone from v2.0.1: one emoji per heading, the symptom before the fix, small tables, and a surprise at the end.
- **Promote outcomes only.** No known gaps, no refactor talk, no CI talk (maintainer ruling, 2026-10-13).
- **Include a stats section,** for example "43 days in numbers". Every figure must trace to §Facts to gather.
- Put the banner on top as a `<picture>` with a dark `source`, served from `https://docs.plus/demo-assets/`. Create the Release after the deploy, so these URLs work. On 2.1.0 the PNGs rode on Release assets while the deploy ran; that was a stopgap, and it added two download rows the maintainer questioned.

### 5. Demo page

- Source: `docs/DEMO.md`, shown at https://docs.plus/demo. It is a read-only document. The owner pastes it through Settings → Markdown replace.
- First run a feature-truth audit: check every claim on the page against the code, and fix the lines that are now wrong.
- Then append a final H1, `# 🆕 What's new in docs.plus X.Y.Z`, with the banner image and one H2 per headline. End each H2 with a filter link such as `/demo/connected%20app`.

### 6. Banner

- Use the Claude Design canvas with the docs.plus design system (`Artifact` quickstart with `intent: "design"`). Make three or more concepts at 1280×720 and let the maintainer pick or combine.
- What worked on 2.1.0: a real pad scene (outline, Find bar, AI app card, QR card, voice note), a big version number, and a strip of real numbers with Lucide icons. It ships in a light theme and a dark theme.
- **Use real product pieces.** Make the QR code with `.cursor/skills/release-product/scripts/qr-svg.ts`; it opens the demo. Take AI logos and icons from `react-icons`, the same set as `apps/webapp/src/utils/aiAppBrands.ts`. Use only numbers from §Facts to gather.
- Third-party logos imply "works with". Confirm each one is true for MCP clients.
- **Render.** `.cursor/skills/release-product/scripts/render-banner.js` (`bun <script> <artboard> <logo.svg> <out.html>`) expands the artboard into one page. Then render it at 2× with headless Chrome: `--headless=new --force-device-scale-factor=2 --window-size=1280,720 --screenshot=<out.png>`. Look at the PNG before saving it.
- Save `release-X.Y.Z-banner.png`, `release-X.Y.Z-banner-dark.png` and both HTML sources in `apps/webapp/public/demo-assets/`.

### 7. Readiness

- A panel of a head of engineering, a senior staff engineer and a tech writer reviews the whole diff and returns blockers.
- Run `LC_ALL=en_US.UTF-8 bun run check:ci`. Without the UTF-8 locale the script tests fail falsely.
- Run `bun run release:family --dry-run` when extensions publish. Expect only the clean-tree and npm-login checks to fail before commit.
- Check the fixed UI in a browser at phone width and on desktop.

## Ship

The maintainer runs these steps, in this order.

1. Commit in groups: fixes first, then `chore(extensions)`, `chore(release): docs.plus X.Y.Z`, `docs(demo)`, and any skill or tooling commit.
2. `git push origin main`. The pre-push hook runs the full `check:ci`, about 10 minutes.
3. **Deploy.** A plain push does not deploy. New `public/` assets need an empty `(build): front` commit and a push. Wait until `curl -sI https://docs.plus/demo-assets/release-X.Y.Z-banner.png` shows `content-type: image/png`. Before the deploy, that URL answers `200 text/html`.
4. **Extensions**, if they publish. The npm account uses a Chrome passkey, so no 6-digit code exists. Publish each package with `(cd extensions/<pkg> && bun publish)` and approve in the browser. Tick "skip two-factor for 5 minutes" so the rest go through. Wait until `npm view <pkg> dist-tags.latest --prefer-online` shows the new version for every package. Then run `bun run release:family`: it skips the publishes, then creates and pushes one tag per package.
5. `git tag vX.Y.Z && git push origin vX.Y.Z`, after the deploy commit.
6. `gh release create vX.Y.Z --title "docs.plus X.Y.Z" --latest --notes-file Notes/release-X.Y.Z/RELEASE-NOTES.md`, after the banner is live.
7. Paste `docs/DEMO.md` on /demo, then check the banner in light and dark.
8. Refresh the Context7 library.

## Traps that bit on 2.1.0

- `release-family.ts` still asks for a 6-digit code. With a passkey, use the by-hand publish in §Ship step 4.
- npm can take minutes to show a new version. hypermultimedia took the longest. A second `bun publish` then answers 403 "cannot publish over", which is harmless.
- The pre-push hook runs `check:ci` for a tag push too.
- A CI Cypress run can fail where local passes. A real key sent right after `editor.commands.focus()` can be lost, because Tiptap focuses in the next animation frame. Wait for `.should('have.focus')` first.
- `gh release create` is not idempotent. Use `gh release edit` after the first run.
- The quickstart check takes folder names (`extension-indent`), not paths.
- `release-family.ts` refuses a dirty tree. Prove changes need their own commit before a rerun.
