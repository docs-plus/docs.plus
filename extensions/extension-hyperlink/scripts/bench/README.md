# Hyperlink bench

Measures this package before and after a change. It builds `src/` at a git ref (`base`, default `main`), a copy of that build (`control`) and your working tree (`head`). It then compares bytes, behaviour and speed. Post its table in the issue or pull request of any change to autolink, paste handling, the build or bundle size.

The bench is not a test. Unit tests and Cypress decide pass or fail. The bench shows what a change costs and what it buys.

## Run

From `extensions/extension-hyperlink`:

```bash
NODE_ENV=production bun scripts/bench/run.ts
```

Options:

- `--ref <ref>`: the "before". Default `main`.
- `--runs <n>`: timed rounds. Default 9.
- `--save <file.json>`: saves the result, with every timed round.
- `--bytes-only`: builds the variants and prints only the byte rows. No behaviour, no speed.
- `--budget <file.json>`: checks head against a byte budget (see Byte budget).

A full run takes about two minutes. A bytes-only run takes a few seconds. Each run builds in a new temp folder and deletes it at exit, so two runs never collide. Nothing is written into the repo.

Pick the ref that is your "before":

- Before you commit, the default `main` is right.
- When several changes sit uncommitted in the tree, copy `src/` before each one and pass `--ref dir:<path to the copy>`.
- After the change is on `main`, `main` already holds it. Pass the commit before it (`--ref <sha>~1`) or the last release tag, for example `--ref @docs.plus/extension-hyperlink@2.3.0`.
- For the published file, pass `--ref npm:<version>`, for example `--ref npm:2.3.0`.

A git ref and an npm ref measure different things:

- **`--ref <git ref>`** rebuilds that ref's `src/` with today's `tsup.config.ts`. It shows what the old source costs under today's build settings. It is not the file on npm.
- **`--ref npm:<version>`** downloads the published tarball from the npm registry, checks it against the registry's integrity hash, and uses its real `dist/`. Only this row is the published value.

With a git ref, only `src/` differs between variants. All variants use this workspace's `@docs.plus/floating-popover` and `@docs.plus/floating-tooltip`. `control` is a copy of the `base` dist, so the A/A pair runs identical code. The saved JSON holds the sha256 of each variant's `dist/index.js`.

## Read the table

- **Bytes.** `dist/index.js` is the npm file, built with the package's real tsup settings. The ESM keeps whitespace and esbuild's `// <path>` comments (#774). The bench builds from the variant folder, so the `// src/…` comments match the npm file. The two floating-package comments name a longer path, so this row sits a little above a real build. Against an npm ref, this row is not comparable: the published file was built with that release's settings. The other byte rows are minified bundles with no comments, so they compare across any refs.
- "A StarterKit app pays" is StarterKit plus Hyperlink, minus StarterKit alone. "Three own slots" fills every popover slot with a stub factory, the way an app with its own forms does. The `HyperlinkBase` rows (#775) show `—` for a ref that has no `HyperlinkBase`. The `normalizeHref`-only row shows how much one helper import pulls in. esbuild minifies every bundle, and every gzip figure uses Bun zlib at level 9, so all rows compare.
- **Behaviour.** 19 cases in jsdom (`behaviour.ts`). A case passes when the editor does what a user expects, which is also what upstream `@tiptap/extension-link` does. A case that still fails on `head` belongs to an open issue.
- **Speed.** Medians over `--runs` rounds. Each round runs every variant once, in rotated order. `control` runs the same code as `base`, so its change is the noise of that run. Treat a smaller change as no change. "Output differs" marks a workload whose final document differs from `base`. That is expected only when the change fixes a bug in that workload.
- Each workload comes in two sizes. The common sizes match a new pad: 25 blocks (`boldAll25`, `typeEnd25`, `mount50Links`) and 30 pasted lines (`pasteText30`). The stress sizes are 2,000 blocks or lines, 250,000 pasted characters and 1,000 links.
- jsdom times compare variants with each other. They are not the time a user waits. The browser run gives those.

## Byte budget

`bytes-budget.json` holds gzip limits for head's `starterKitApp` and `helperOnly` rows. With `--budget scripts/bench/bytes-budget.json`, `run.ts` exits 1 when head is above a limit.

The limits are the `base` gzip values of `--ref npm:2.3.0 --bytes-only`, the published 2.3.0 file. A `null` limit prints "no limit set" and passes.

## CI

The `extension-bytes` job in `.github/workflows/prod.docs.plus.yml` runs once per pull request that starts this package's suite, not once per matrix leg. That is any change under this package, and any shared input in `.github/filters/extensions.yaml`. It runs:

```bash
NODE_ENV=production bun scripts/bench/run.ts --ref main --bytes-only
```

It writes the table to the run summary and uploads the saved JSON. It posts no PR comment and never runs on the production host. The `--budget` check is not in CI. Head is above the `starterKitApp` limit today, so CI would fail. Timings never run in CI: hosted runners swing about 2×.

## What an npm user's app pays

At release time, build `dist/` with `bun run build`, then run:

```bash
bun scripts/bench/consumer-bytes.ts --version 2.3.0
```

It copies `examples/vanilla` into two temp folders. One installs the published version. The other installs the `bun pm pack` tarball of this package. Both build with Vite, and the script prints the JS and CSS delta. It needs the npm registry, so it never runs in CI. It refuses to run when `dist/` is older than `src/`. It fails when the two copies resolve different versions of `@tiptap/*`, `linkifyjs`, `@floating-ui/dom` or Vite. It writes nothing into the repo.

## Speed in a real browser

```bash
NODE_ENV=production bun scripts/bench/browser.ts [--ref main] [--runs 9] [--save file.json]
```

It serves one page on `http://127.0.0.1:5199`. The page is cross-origin isolated (COOP and COEP headers), so `performance.now()` is not coarsened. Before each timed round it settles: two task yields, then one idle callback with a 200 ms cap. The saved JSON holds every timed round, `crossOriginIsolated`, the smallest timer step, the settle timeouts and an idle timer-lag probe. A page with idle lag over 50 ms, or one that was hidden, marks itself "background"; then only its ratios count.

### Chromium, driven

```bash
NODE_ENV=production bun scripts/bench/drive.ts --ref npm:2.3.0 --runs 15 --label s1 --out <dir>
```

One call is one session: one headless Chrome for Testing 158.0.8127.18 (build 1254), launched through Playwright 1.64.1. It never uses system Chrome, which updates itself. It writes `<dir>/<label>.json`: the `browser.ts` result plus a `drive` record with the browser version, the load average at start and end, and the timestamps. `--ref` passes through to `browser.ts`. Run sessions one after another, never two at once, on an idle machine.

### Firefox, by hand

There is no Firefox flag. In one terminal, start the page:

```bash
NODE_ENV=production bun scripts/bench/browser.ts --ref npm:2.3.0 --runs 15 --save <dir>/firefox-s1.json
```

When it prints the URL, open the page in headless Firefox with a throwaway profile, in a second terminal:

```bash
/Applications/Firefox.app/Contents/MacOS/firefox -headless -profile "$(mktemp -d)" -no-remote http://127.0.0.1:5199
```

Firefox keeps running after `browser.ts` saves and exits, so stop it with Ctrl-C. Record `firefox --version` with each session, and do not mix versions in one series.

## Pool sessions

```bash
bun scripts/bench/summarize.ts <dir>/s1.json <dir>/s2.json ...
```

It reads two or more saved sessions. The unit is the session: rounds inside one session are not independent. Per workload it prints:

- **head/base.** Each session's head median over its base median. The table shows the median of those ratios, the range and each session's value.
- **control/base range.** The same ratio for `control`. This is the noise floor.
- **σ.** The sample standard deviation (n − 1) of ln(control/base) across sessions.
- **MDE**, the minimum detectable effect at this session count n: e^(k·σ) − 1, with k = (t₀.₉₇₅ + t₀.₈₀) / √n and t on n − 1 degrees of freedom. A real change at least this large shows in a two-sided 5% test 80% of the time. The t values come from a short expansion of the normal ones; it is about 1% low at 6 sessions.

It warns when sessions differ in ref, browser or dist sha256, or when a session ran as a background page or without cross-origin isolation.

## Files

| File                | Role                                                                |
| ------------------- | ------------------------------------------------------------------- |
| `run.ts`            | jsdom run: bytes, behaviour, speed, the table and the budget check. |
| `browser.ts`        | The speed workloads in a real browser.                              |
| `drive.ts`          | One headless Chrome for Testing session of `browser.ts`.            |
| `summarize.ts`      | Pools saved sessions: ratios, noise floor, σ and MDE.               |
| `consumer-bytes.ts` | The Vite example app, published version against the packed head.    |
| `build.ts`          | Builds `base`, `control` and `head`, or fetches a published `base`. |
| `bytes.ts`          | The byte rows and the budget check.                                 |
| `bytes-budget.json` | Gzip limits for head, from the published 2.3.0 file.                |
| `behaviour.ts`      | The behaviour cases.                                                |
| `workloads.ts`      | The timed actions, shared by jsdom and the browser.                 |
| `table.ts`          | The Markdown table.                                                 |
| `paths.ts`          | Shared paths and helpers.                                           |
