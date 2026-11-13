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
- **Benchmarks.** Every before-and-after number since the base, audited as §Benchmarks says. When a release has one, it goes into the release note, the demo page and the changelog Highlights (maintainer ruling, 2026-11-09).
- **Changed packages.** Which `package.json` files must move, and which extension `src/` trees changed.
- **Headline features.** Read the closed issues and the commits. Ask the maintainer which UI items to show; on 2.1.0 the Find bar and the Share card QR code were missed until they sent screenshots.

## Benchmarks

Built on 2.3.0 (2026-11-09), where an audit corrected about 30 claims before they shipped. The ledger and its evidence are in `Notes/local-docs/2026-11-09-v230-team/`.

1. **Collect.** Read every `perf` commit body, the issue comments that hold results, and each module's `BENCHMARK.md`. Put each number in one ledger, `BENCHMARKS.md`, beside the release notes. A row holds the before and after, where it ran (production, laptop, dev build, headless Chrome), n, the source, and a Use: Promote, Note, Internal or No claim.
2. **Audit.** Two agents check every row against its source, and assume it is wrong until proved. Save what they read in an `evidence/` folder.
3. **Re-run** what runs locally, one at a time: `apps/hocuspocus.server/scripts/bench-link-extractor.ts`, `redis-sync-probe.ts` and `bench-prisma-bytea.ts`. Record the date, machine, command and raw output. Mark a re-run row 🔁, and say whether one side or both sides ran again.
4. **Promote.**
   - The release note gets a "⚡ Faster and steadier" table: Before, Now, Measured on.
   - The demo page gets a `### Faster and steadier` H3 in the release's What's new entry.
   - Each changelog gets a Highlights bullet.
   - Quote only Promote and Note rows.
5. **Proof-check.** Two agents test every claim in the finished copy against the ledger. Fix every finding before the copy ships.

Rules the 2.3.0 audit found:

- **Keep the condition.** "In a dev build" and "on one laptop" stay in every sentence that quotes such a number.
- **Compare release to release.** Never quote a "before" that includes a feature that never shipped. On 2.3.0 that turned 330 → 129 ms into 213 → 129 ms.
- **No production claim without a production before.** A production "after" alone is "its longest frame is …", never "opens faster".
- **Name the measured thing.** A fill frame is not page open, and a pad that renders is not one that opens.
- **Counts trace to logs.** Save the test logs, and recount tests, issues and commits at the tag.

Rules the 2.3.8 bench work found:

- **Isolate one change before you clear it.** A run of the full head against the last release hid a +4.5 % cost of one change under the gains of the others. Run base = the commit before the change, head = the change, before you call its cost noise.
- **Keep a control in every timed run.** `control` is a copy of `base`. Its change is the noise of that run. Quote a head change only when every session sits outside the control range; report σ and the MDE beside it.
- **Pin every browser for a series.** Use Chrome for Testing and Playwright's WebKit, which do not update themselves. A system browser can update mid-series (Firefox 159 became 160 on 2026-11-13) or lose focus (Safari). Record the version per session, and void a session whose version or focus changed.
- **Prove the harness compares what it claims.** A marker that exists only in `base` must appear only in `base`'s build. On 2026-11-13 every variant was built from the working tree, so `base` equalled `head`; a skeptic caught it before any timed run.

## Artifacts and their rules

Every prose file follows the [tech-writer](../tech-writer/SKILL.md) skill and Simplified English.

### 1. Changelogs

- Root `CHANGELOG.md`, and the `CHANGELOG.md` of every app, package and extension whose folder changed since the base commit. The Changelogs paragraph of [`RELEASE_POLICY.md`](../../../RELEASE_POLICY.md) says which change goes where.
- Keep an empty `## [Unreleased]` heading above the new `## [X.Y.Z] — YYYY-MM-DD` entry.
- Sections: Highlights, Breaking, Migration, Added, Changed, Fixed, Security, Removed, Documentation, Internal. Link each item to its issue.
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
- **Include a "⚡ Faster and steadier" section** when the release has benchmarks (§Benchmarks).
- **List every user-facing change: the note covers the whole changelog, not a pick.** Write the note from the root `CHANGELOG.md` entry, not from memory or the marketing story. Before you call the note done, run `bun .agents/skills/release-product/scripts/note-coverage.ts X.Y.Z`. It prints three lists: entries the note does not cite, entries whose issue the note cites but that share it with other entries, and entries with no reference. Write a decision for every printed line in a `COVERAGE.md` file in that release's notes folder: the note line that covers it, or a reason you can name (internal, CI or deploy, admin-only, self-host internals, or already counted, for example inside "N security issues closed"). Show the maintainer that file. On 2.3.0 the first note missed eleven user-visible changes, among them a link-rename fix, heading links and chats, the tick rail card and Google sign-in branding. The maintainer had to ask twice (ruling, 2026-11-09).
- **The devil is in the details** (maintainer ruling, 2026-11-09). A half mention is a miss: each detail gets its own clear line in user words. Write keys as ⌘+K (Ctrl+K), never `Mod+K`. One `#242` link once hid eighteen entries, among them the link keys, the link form cleanup and three privacy fixes. That is why the script has the shared-issue list. Promote the small details too: shortcuts, privacy wins, small fixes and speed numbers sell the product.
- **The demo's What's new gets the same check.** Each note bullet that a reader can try needs a line in `docs/DEMO.md`, or a stated reason why not.
- **The demo shows the editor's formats** (maintainer ruling, 2026-11-09). Write it like a pro user: ordered lists for steps, task lists for fixes, tables for keys and kinds, a bold lead per feature item, one `==highlight==` per section at most, a quote for one promise, and Mermaid for a flow. A section of plain paragraphs is not done. Keep every heading byte for byte. Every `/demo/<word>` link is a measured filter, and matching is per text run: never mark part of a multi-word term, and add no filter word to a section that lacks it ("like a folder" matches `fold`). Check a demo edit with a filter compare and the real Markdown import before you hand it over. `docs/DEMO.md` is now over the 64 KiB Markdown replace cap, so publish it through the docs.plus MCP tools, section by section: keep every media block, replace the text around it, re-read before each edit, and never retry blind (#719–#722). Inline code cannot carry bold (#721).
- Put the banner on top as a `<picture>` with a dark `source`, served from `https://docs.plus/demo-assets/`. Create the Release after the deploy, so these URLs work. On 2.1.0 the PNGs rode on Release assets while the deploy ran; that was a stopgap, and it added two download rows the maintainer questioned.

### 5. Demo page

- Source: `docs/DEMO.md`, shown at https://docs.plus/demo. It is a read-only document. The owner pastes it through Settings → Markdown replace.
- First run a feature-truth audit: check every claim on the page against the code, and fix the lines that are now wrong.
- The page ends with one H1, `# 🆕 What's new`, newest release first. Add the release as `## docs.plus X.Y.Z` right under that H1, with the banner image, the date, and one H3 per headline. End each H3 with a filter link such as `/demo/connected%20app`. Never add a second What's new H1 (maintainer ruling, 2026-10-22).
- When the release has benchmarks, add a `### Faster and steadier` H3 with the Promote rows, each with its condition (§Benchmarks). Its filter term must appear only in that H3.
- **Every new section gets a picture before the release** (maintainer ruling, 2026-11-09). That covers each section the release adds, and each section whose feature changes what a reader sees. 2.3.0 needed seven (`d18` to `d24`), because its link sections were written with none.
  - Build each picture from the house kit `kit.css`, in the untracked folder `Notes/PROPOSAL-demo/`, at 1280×720, as one HTML file beside it, such as `d18-link-icons.html`. The folder's README holds the rules. Never draw a second visual language.
  - A team works best: designers propose concepts through different lenses, an art director merges them into one brief per picture, one illustrator builds each picture, and a fresh reviewer checks it against the code. A drawn UI part that does not match the code is a blocker.
  - Render with headless Chrome at 1x: `--headless=new --hide-scrollbars --window-size=1280,720 --screenshot=<png> file://<html>`. Look at every PNG yourself before it ships.
  - When the server draws the real thing (a social card, say), render the real output, as the kit folder's `render-kinds.ts` script does in its `cards` folder.
  - Copy each PNG to `apps/webapp/public/demo-assets/`, and put it after the section's first paragraph with alt text that says what it shows.
  - Never picture a feature that production has off. Hold that picture and its text until the switch-on.

### 6. Banner

- Use the Claude Design canvas with the docs.plus design system (`Artifact` quickstart with `intent: "design"`). Make three or more concepts at 1280×720 and let the maintainer pick or combine.
- What worked on 2.1.0: a real pad scene (outline, Find bar, AI app card, QR card, voice note), a big version number, and a strip of real numbers with Lucide icons. It ships in a light theme and a dark theme.
- **Use real product pieces.** Make the QR code with `.agents/skills/release-product/scripts/qr-svg.ts`; it opens the demo. Take AI logos and icons from `react-icons`, the same set as `apps/webapp/src/utils/aiAppBrands.ts`. Use only numbers from §Facts to gather.
- Third-party logos imply "works with". Confirm each one is true for MCP clients.
- **Render.** `.agents/skills/release-product/scripts/render-banner.js` (`bun <script> <artboard> <logo.svg> <out.html>`) expands the artboard into one page. Then render it at 2× with headless Chrome: `--headless=new --force-device-scale-factor=2 --window-size=1280,720 --screenshot=<out.png>`. Look at the PNG before saving it.
- Save `release-X.Y.Z-banner.png`, `release-X.Y.Z-banner-dark.png` and both HTML sources in `apps/webapp/public/demo-assets/`.
- **What the maintainer rejected on 2.3.0, in five rounds.** A banner that sells one feature, such as one hovercard on an empty well. A clean window with only two actions. A grid of equal tiles. Captions over the UI ("You paste", "A web page"). Each one read as a manual page, not as the product.
- **What the maintainer accepted on 2.3.0.** One real pad window as the stage: outline, presence faces and an unread badge. Every new piece sits in it or breaks out of it, slightly tilted (−2.5°, 1.5° or 2°). The headline is a short verb beat ("Link it. Peek at it. Move it."), and the subline names every piece drawn. The strip holds five numbers with icon tiles.
- **Draw each piece from its code.** Read the component and its SCSS before you draw it: chip kinds and icons, preview layout and strings, the drag card, the ghost slot and the nest ring. A server-rendered image, such as the share card, goes in as the real PNG from production (`og:image`). Embed it in the HTML source as a `data:` URI, and point other logos at `../icons/logo.svg`, so the source works from disk and on docs.plus.
- **Numbers come from the audited ledger only** (§Benchmarks). A number marked "Note" or that needs "dev build" or "laptop" beside it stays in the release note, not on the banner. On 2.3.0, a label count (37 `bug` issues) differed from the audited count (33 fixed). The ledger wins.
- **Before saving, check the live facts again.** That means the share card bytes, a repository's "Updated" date and every count. Recheck them if the release date slips.

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
7. Paste `docs/DEMO.md` on /demo, then check the banner in light and dark, and that every new picture loads.
8. Refresh the Context7 library.

## Traps that bit on 2.1.0

- `release-family.ts` still asks for a 6-digit code. With a passkey, use the by-hand publish in §Ship step 4.
- npm can take minutes to show a new version. hypermultimedia took the longest. A second `bun publish` then answers 403 "cannot publish over", which is harmless.
- The pre-push hook runs `check:ci` for a tag push too.
- A CI Cypress run can fail where local passes. A real key sent right after `editor.commands.focus()` can be lost, because Tiptap focuses in the next animation frame. Wait for `.should('have.focus')` first.
- `gh release create` is not idempotent. Use `gh release edit` after the first run.
- The quickstart check takes folder names (`extension-indent`), not paths.
- `release-family.ts` refuses a dirty tree. Prove changes need their own commit before a rerun.
