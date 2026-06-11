# `@docs.plus/extension-*` family

Five publishable Tiptap extensions for the [docs.plus](https://docs.plus) alpha v2 line. All share major version `2.x` under the `@docs.plus` npm scope.

| Package                                                     | Description                                           | CSS export     | Clean-room port |
| ----------------------------------------------------------- | ----------------------------------------------------- | -------------- | --------------- |
| [`extension-hyperlink`](./extension-hyperlink/)             | Hyperlink mark, autolink, popovers, URL safety        | `./styles.css` | 5173            |
| [`extension-hypermultimedia`](./extension-hypermultimedia/) | Images, audio, video, embeds (YouTube, Vimeo, X, …)   | `./styles.css` | 5174            |
| [`extension-indent`](./extension-indent/)                   | Tab / Shift-Tab literal indent with context allowlist | —              | 5175            |
| [`extension-inline-code`](./extension-inline-code/)         | Inline code mark (`Mod-e`, backtick rules)            | —              | 5176            |
| [`extension-placeholder`](./extension-placeholder/)         | O(1) cursor-based empty-node placeholder              | BYO CSS        | 5177            |

## Install (Phase 1 — alpha soak)

During cutover, new majors publish to npm **`@next`**, not `@latest`:

```sh
bun add @docs.plus/extension-hyperlink@next
# stable, after promotion:
bun add @docs.plus/extension-hyperlink
```

**Peer dependencies (all five):** `@tiptap/core` and `@tiptap/pm` **^3.22.3**.

**Node:** `>=24.11.0` for monorepo development.

## Recommended pairings

- **Hyperlink + hypermultimedia:** `shouldAutoLink: (url) => !isMediaUrl(url)` so media URLs become embed nodes, not links.
- **Inline code + StarterKit:** `StarterKit.configure({ code: false })`.
- **Placeholder:** no bundled CSS — add `[data-placeholder]::before` (see package README).

## Release policy

[RELEASE_POLICY.md](../RELEASE_POLICY.md) — versioning, lockstep Phase 2, soak/promotion, CHANGELOG style.

Cutover tracker: [.cursor/docs/extension-version-cutover.md](../.cursor/docs/extension-version-cutover.md).

## Contributing

Each package has its own [CONTRIBUTING.md](./extension-hyperlink/CONTRIBUTING.md) — see
[hyperlink](./extension-hyperlink/CONTRIBUTING.md),
[hypermultimedia](./extension-hypermultimedia/CONTRIBUTING.md) (full README **Gallery**, 18 PNGs),
[indent](./extension-indent/CONTRIBUTING.md),
[inline-code](./extension-inline-code/CONTRIBUTING.md), and
[placeholder](./extension-placeholder/CONTRIBUTING.md). Hero or gallery PNGs: `bun run docs:screenshots`
in the package (`cypress/docs/` → `assets/`).

From the repo root:

```sh
bash scripts/build-extensions.sh
EXTENSION_DIST_READY=1 bash scripts/run-tests.sh --extensions
bash scripts/extension-preflight.sh
```

Package list and gate metadata: `scripts/publishable-extensions.ts` (also imported by `release-family.ts`). CI sets `EXTENSION_DIST_READY=1` after `build-extensions` so Cypress skips per-package `pretest` rebuilds.

## Announcements

Per-package Discord embeds: [RELEASE_POLICY.md](../RELEASE_POLICY.md#decision-per-package-releases-over-umbrella).
