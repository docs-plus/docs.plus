# Hyperlink bench

Measures this package before and after a change. It builds `src/` at a git ref (`base`, default `main`), a second copy of it (`control`) and your working tree (`head`). It then compares bytes, behaviour and speed. Post its table in the issue or pull request of any change to autolink, paste handling, the build or bundle size.

The bench is not a test. Unit tests and Cypress decide pass or fail. The bench shows what a change costs and what it buys.

## Run

From `extensions/extension-hyperlink`:

```bash
NODE_ENV=production bun scripts/bench/run.ts
```

Options: `--ref <git ref>` (default `main`), `--runs <n>` (default 9) and `--save <file.json>`. A run takes about two minutes. Builds go to the OS temp folder, never into the repo.

Pick the ref that is your "before":

- Before you commit, the default `main` is right.
- When several changes sit uncommitted in the tree, copy `src/` before each one and pass `--ref dir:<path to the copy>`.
- After the change is on `main`, `main` already holds it. Pass the commit before it (`--ref <sha>~1`) or the last release tag, for example `--ref @docs.plus/extension-hyperlink@2.3.0`.

Only `src/` differs between variants. All three use this workspace's `@docs.plus/floating-popover` and `@docs.plus/floating-tooltip`, and the package's current build settings.

For speed in a real browser:

```bash
NODE_ENV=production bun scripts/bench/browser.ts
```

Open the printed `http://127.0.0.1:5199` in a normal browser window, keep the window in front, and do not use the page until it says done. The script prints the table and exits. Run nothing heavy at the same time.

## Read the table

- **Bytes.** `dist/index.js` is the npm file, built with the package's real tsup settings. "A StarterKit app pays" is StarterKit plus Hyperlink, minus StarterKit alone. The `normalizeHref`-only row shows how much one helper import pulls in. esbuild minifies every bundle, and every gzip figure uses Bun zlib at level 9, so all rows compare.
- **Behaviour.** 18 cases in jsdom (`behaviour.ts`). A case passes when the editor does what a user expects, which is also what upstream `@tiptap/extension-link` does. A case that still fails on `head` belongs to an open issue.
- **Speed.** Medians over `--runs` rounds. Each round runs every variant once, in rotated order. `control` is identical to `base`, so its change is the noise of that run. Treat a smaller change as no change. "Output differs" marks a workload whose final document differs from `base`. That is expected only when the change fixes a bug in that workload.
- jsdom times compare variants with each other. They are not the time a user waits. The browser run gives those. It marks itself "background" when the browser throttled the page, and then only its ratios count.

## Files

| File           | Role                                                                  |
| -------------- | --------------------------------------------------------------------- |
| `run.ts`       | jsdom run: bytes, behaviour, speed, and the table.                    |
| `browser.ts`   | The speed workloads in a real browser.                                |
| `build.ts`     | Builds `base`, `control` and `head` with the package's tsup settings. |
| `bytes.ts`     | The byte rows.                                                        |
| `behaviour.ts` | The behaviour cases.                                                  |
| `workloads.ts` | The timed actions, shared by jsdom and the browser.                   |
| `table.ts`     | The Markdown table.                                                   |
| `paths.ts`     | Shared paths and helpers.                                             |
