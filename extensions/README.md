# `@docs.plus/extension-*` family

Five publishable Tiptap extensions for the [docs.plus](https://docs.plus) alpha v2 line. All share major version `2.x` under the `@docs.plus` npm scope.

| Package                                                     | Description                                           | CSS export     | Clean-room port |
| ----------------------------------------------------------- | ----------------------------------------------------- | -------------- | --------------- |
| [`extension-hyperlink`](./extension-hyperlink/)             | Hyperlink mark, autolink, popovers, URL safety        | `./styles.css` | 5173            |
| [`extension-hypermultimedia`](./extension-hypermultimedia/) | Images, audio, video, embeds (YouTube, Vimeo, X, …)   | `./styles.css` | 5174            |
| [`extension-indent`](./extension-indent/)                   | Tab / Shift-Tab literal indent with context allowlist | —              | 5175            |
| [`extension-inline-code`](./extension-inline-code/)         | Inline code mark (`Mod-e`, backtick rules)            | —              | 5176            |
| [`extension-placeholder`](./extension-placeholder/)         | O(depth) cursor-based empty-node placeholder          | BYO CSS        | 5177            |

## Install

```sh
bun add @docs.plus/extension-hyperlink
```

Use the matching package name from the table above (`extension-hypermultimedia`, `extension-indent`, and so on).

**Peer dependencies (all five):** `@tiptap/core` and `@tiptap/pm` **^3.22.3**.

**Node:** `>=24.11.0` for monorepo development.

## Recommended pairings

- **Hyperlink + hypermultimedia:** `shouldAutoLink: (url) => !isMediaUrl(url)` so media URLs become embed nodes, not links.
- **Inline code + StarterKit:** `StarterKit.configure({ code: false })`.
- **Placeholder:** no bundled CSS — add `[data-placeholder]::before` (see package README).

## Vocabulary

Two axes, never one word for both jobs:

- **Popover** — the positioning container: anchored, floating, light-dismiss. Owned by the shared `floating-popover` engine; shells are role-less by default (ARIA has no popover role — the surface carries its content's role).
- **Toolbar / form / menu** — the content inside a surface, named by what it is and carrying the matching ARIA role. In hypermultimedia, the media toolbar is a persistent in-node action bar (`role="toolbar"`). In hyperlink, the preview is a toolbar _in_ a popover, and create/edit are forms (`role="dialog"`) _in_ popovers.
- **Composed names** follow the industry shape (CKEditor "balloon toolbar", Fluent `MenuPopover`): `openToolbarPopover` opens a popover anchored to the media toolbar.

## Release policy

[RELEASE_POLICY.md](../RELEASE_POLICY.md) — versioning, lockstep Phase 2, release readiness, CHANGELOG style.

Cutover tracker: [.cursor/docs/extension-version-cutover.md](../.cursor/docs/extension-version-cutover.md).

## Contributing

Each package has its own [CONTRIBUTING.md](./extension-hyperlink/CONTRIBUTING.md) — see
[hyperlink](./extension-hyperlink/CONTRIBUTING.md),
[hypermultimedia](./extension-hypermultimedia/CONTRIBUTING.md) (full README **Gallery**, 20 PNGs),
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

To work on one extension, scope all three scripts with `EXT_ONLY` — space-separated directory names, the same variable CI passes per matrix job:

```sh
EXT_ONLY=extension-indent bash scripts/build-extensions.sh
EXT_ONLY=extension-indent EXTENSION_DIST_READY=1 bash scripts/run-tests.sh --extensions
EXT_ONLY=extension-indent bash scripts/extension-preflight.sh
```

`build-extensions.sh` builds `floating-popover` and `floating-tooltip` on every run, whatever `EXT_ONLY` holds, so hyperlink and hypermultimedia never miss the two packages they bundle. Separately, hypermultimedia's playground fixture imports `@docs.plus/extension-hyperlink`, so scope that pair together: `EXT_ONLY="extension-hyperlink extension-hypermultimedia"`.

## Announcements

Per-package Discord embeds: [RELEASE_POLICY.md](../RELEASE_POLICY.md#decision-per-package-releases-over-umbrella).
