# `@docs.plus/extension-*` family

Five publishable Tiptap extensions for [docs.plus](https://docs.plus). Every package in this directory is at `2.0.0`, so the family shares one major under the `@docs.plus` npm scope. [Release policy](#release-policy) links the tracker that holds the npm status of each one.

| Package                                                     | Description                                                                                   | CSS export     | Clean-room port |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------- | --------------- |
| [`extension-hyperlink`](./extension-hyperlink/)             | Hyperlink mark, autolink, optional prebuilt popovers, dangerous-scheme gate                   | `./styles.css` | 5173            |
| [`extension-hypermultimedia`](./extension-hypermultimedia/) | Nine media nodes: image, audio, video, YouTube, Vimeo, SoundCloud, Spotify, X, Loom           | `./styles.css` | 5174            |
| [`extension-indent`](./extension-indent/)                   | Tab / Shift-Tab literal indent with a context allowlist                                       | none           | 5175            |
| [`extension-inline-code`](./extension-inline-code/)         | Inline code mark (`Mod-e`, backtick rules)                                                    | none           | 5176            |
| [`extension-placeholder`](./extension-placeholder/)         | Hint text in the empty textblock at the cursor; cost tracks cursor depth, not document length | none           | 5177            |

## Install

```sh
bun add @docs.plus/extension-hyperlink
```

Use the matching package name from the table above (`@docs.plus/extension-hypermultimedia`, `@docs.plus/extension-indent`, and so on).

Requires **`@tiptap/core` ^3.22.3** and **`@tiptap/pm` ^3.22.3** (Tiptap 3.x).

`extension-hyperlink` installs `@floating-ui/dom` and `linkifyjs`. `extension-hypermultimedia` installs `@floating-ui/dom`. The other three install with no runtime dependencies. None of the five declares a Node or Bun engine floor.

`extension-inline-code` is the one package with an extra floor. Its backtick rules use RegExp lookbehind, so it needs an engine with RegExp lookbehind — Chrome 62+, Firefox 78+, Safari and iOS Safari 16.4+.

Two packages ship a stylesheet, imported as `@docs.plus/extension-hyperlink/styles.css` and `@docs.plus/extension-hypermultimedia/styles.css`. The other three ship no CSS, and each package README holds the rule to add in its Styling section. `extension-placeholder` renders nothing at all until you add that rule.

## Recommended pairings

Three of these entries are required, not optional: two packages replace a StarterKit mark, and one replaces a Tiptap built-in.

- **Hyperlink + StarterKit — required.** `StarterKit.configure({ link: false })`. StarterKit v3 bundles `@tiptap/extension-link`. The two marks collide on the `setLink` / `unsetLink` / `toggleLink` command names and on the `a[href]` parse rule. Your `extensions` array order then decides each contest, with no warning. If the upstream mark wins, this package's scheme gate never runs on parsed or pasted HTML.
- **Inline code + StarterKit — required.** `StarterKit.configure({ code: false })`. Both marks render `<code>` and both bind `Mod-e`.
- **Placeholder + the Tiptap built-in — required.** Remove the built-in from the extensions array. Both register the name `placeholder`, so both decorate the document.
- **Hyperlink + hypermultimedia.** `Hyperlink.configure({ shouldAutoLink: (url) => !isMediaUrl(url) })`, so a pasted media URL becomes a media node instead of a link. `isMediaUrl` matches every provider whatever the kit configuration holds, so compose the veto from the per-provider validators when you disable providers. Each package also owns its own popover controller, so opening a popover in one never dismisses the popover of the other.
- **Indent + lists and tables.** `@tiptap/extension-list` and `@tiptap/extension-table` bind Tab at the Tiptap default `priority: 100`. `extension-indent` registers at `25`, so it sees Tab last, and literal indent runs only where list and table both return `false`.

## Vocabulary

The five packages use these words and no synonym. Two axes, never one word for both jobs:

- **Popover** — the positioning container: anchored, floating, light-dismiss. Owned by the shared `floating-popover` engine; shells are role-less by default (ARIA has no popover role — the surface carries its content's role).
- **Toolbar / form / menu** — the content inside a surface, named by what it is and carrying the matching ARIA role. In hypermultimedia, the media toolbar is a persistent in-node action bar (`role="toolbar"`). In hyperlink, the preview is a toolbar _in_ a popover, and create/edit are forms (`role="dialog"`) _in_ popovers.
- **Composed names** follow the industry shape (CKEditor "balloon toolbar", Fluent `MenuPopover`): `openToolbarPopover` opens a popover anchored to the media toolbar.

### Surface names

Four packages carry a Keyboard shortcuts table, and every Context cell in them names one of these surfaces. `extension-placeholder` binds no key, so it carries no such table.

| Surface            | Package                                         | What it names                                         |
| ------------------ | ----------------------------------------------- | ----------------------------------------------------- |
| `document`         | hyperlink, hypermultimedia, indent, inline-code | a key bound on the editor document                    |
| `popover`          | hyperlink                                       | the popover root, whatever content it holds           |
| `create-link form` | hyperlink                                       | the create-link form content                          |
| `edit-link form`   | hyperlink                                       | the edit-link form content                            |
| `media toolbar`    | hypermultimedia                                 | the in-node action bar at the node's top-right corner |
| `media caption`    | hypermultimedia                                 | the editable `<figcaption>` on a media node           |
| `replace-URL form` | hypermultimedia                                 | the URL form the Replace URL action opens             |
| `resize drag`      | hypermultimedia                                 | a pointer drag on a gripper handle                    |

## Release policy

[RELEASE_POLICY.md](../RELEASE_POLICY.md) — versioning doctrine, lockstep, release readiness, CHANGELOG style.

Per-package npm status and the publish runbook: [.cursor/docs/extension-version-cutover.md](../.cursor/docs/extension-version-cutover.md).

## Contributing

Each package has its own CONTRIBUTING.md — see
[hyperlink](./extension-hyperlink/CONTRIBUTING.md),
[hypermultimedia](./extension-hypermultimedia/CONTRIBUTING.md) (full README **Gallery**, 20 PNGs),
[indent](./extension-indent/CONTRIBUTING.md),
[inline-code](./extension-inline-code/CONTRIBUTING.md), and
[placeholder](./extension-placeholder/CONTRIBUTING.md). Hero or gallery PNGs: `bun run docs:screenshots`
in the package (`cypress/docs/` → `assets/`).

Monorepo development needs Node `>=24.11.0` and Bun `>=1.4.0`, the floors the root `package.json` sets.

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
