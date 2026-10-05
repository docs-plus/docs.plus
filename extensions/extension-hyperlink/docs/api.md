# API reference

Part of the [`@docs.plus/extension-hyperlink` README](../README.md).

## Options

Every key below goes into `Hyperlink.configure({ … })`.

| Option                 | Type                                                                                                                                                                                                                                                                 | Default                                                                  | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `autolink`             | `boolean`                                                                                                                                                                                                                                                            | `true`                                                                   | Converts URLs to links as you type. The mark is never inclusive, so text typed at either edge of a link stays plain.                                                                                                                                                                                                                                                                                                                                                               |
| `openOnClick`          | `boolean`                                                                                                                                                                                                                                                            | `true`                                                                   | Gates the whole click plugin. Primary click opens the preview popover. With no `popovers.previewHyperlink`, a read-only editor opens the link in a new tab, and an editable editor opens no popover. `false` removes every pointer handler the package binds, including the click guard and the middle-click gate.                                                                                                                                                                 |
| `linkOnPaste`          | `boolean`                                                                                                                                                                                                                                                            | `true`                                                                   | Wraps a non-empty selection in a link when the clipboard holds exactly one URL. It gates that path only — a pasted bare URL still autolinks at `false`. See [Caveats](#caveats).                                                                                                                                                                                                                                                                                                   |
| `protocols`            | `Array<LinkProtocolOptions \| string>`                                                                                                                                                                                                                               | `[]`                                                                     | Extra schemes registered with [linkifyjs](https://linkify.js.org), which is what makes paste detect them. Each scheme registers once per process. The built-in catalog is separate and registers nothing with linkifyjs. See [URL handling](./url-handling.md).                                                                                                                                                                                                                    |
| `HTMLAttributes`       | `Partial<HyperlinkAttributes>`                                                                                                                                                                                                                                       | `{ target: null, rel: 'noopener noreferrer nofollow', class: null }`     | Attributes merged onto every rendered `<a>`. A `null` value renders nothing, so the default anchor carries `rel` only. A `target` set here does reach the DOM — see [Caveats](#caveats).                                                                                                                                                                                                                                                                                           |
| `popovers`             | `{ previewHyperlink?: ((options: PreviewHyperlinkOptions) => HTMLElement \| null) \| null; editHyperlink?: ((options: EditHyperlinkOptions) => HTMLElement \| null) \| null; createHyperlink?: ((options: CreateHyperlinkOptions) => HTMLElement \| null) \| null }` | `{ previewHyperlink: null, editHyperlink: null, createHyperlink: null }` | One factory per popover slot. The three openers fall back to the prebuilt factory when a slot is `null`. The click handler does not: leave `previewHyperlink` at `null` and a click on a link opens no popover. A factory that returns `null` opts out of that popover. See [Popovers](./popovers.md).                                                                                                                                                                             |
| `validate`             | `(url: string) => boolean`                                                                                                                                                                                                                                           | `undefined`                                                              | URL gate at every write boundary, after `isSafeHref`. Return `false` to reject. See [`validate` vs `isAllowedUri`](#validate-vs-isalloweduri).                                                                                                                                                                                                                                                                                                                                     |
| `defaultProtocol`      | `string`                                                                                                                                                                                                                                                             | `'https'`                                                                | Scheme used when promoting bare domains (`example.com` → `${defaultProtocol}://example.com`). See [URL handling](./url-handling.md).                                                                                                                                                                                                                                                                                                                                               |
| `isAllowedUri`         | `(uri: string, ctx: IsAllowedUriContext) => boolean`                                                                                                                                                                                                                 | `undefined`                                                              | URL gate, Tiptap-canon shape. Same write boundaries as `validate`; `ctx` carries `{ defaultValidate, protocols, defaultProtocol }`. See [`validate` vs `isAllowedUri`](#validate-vs-isalloweduri).                                                                                                                                                                                                                                                                                 |
| `shouldAutoLink`       | `(uri: string) => boolean`                                                                                                                                                                                                                                           | `undefined`                                                              | Per-URI autolink veto. The autolink plugin, the paste handler, and the linkify paste rule all consult it. An explicit `setHyperlink` write skips it, because that is user intent.                                                                                                                                                                                                                                                                                                  |
| `enableClickSelection` | `boolean`                                                                                                                                                                                                                                                            | `false`                                                                  | With `true`, a click inside a link in an editable editor selects the whole mark range. That expansion also needs a collapsed selection. Every other case places the caret at the clicked position, and keeps a non-empty selection only when it overlaps the link. A read-only editor is one of those cases. All paths need a mounted preview popover, so with an empty `popovers.previewHyperlink` slot the package writes no selection at all. Mirrors `@tiptap/extension-link`. |
| `exitable`             | `boolean`                                                                                                                                                                                                                                                            | `false`                                                                  | With `true`, ArrowRight at the end of a link drops a stored hyperlink mark, such as one `setHyperlink` leaves on a collapsed caret. Text typed at the right edge is plain either way, because the mark is never inclusive.                                                                                                                                                                                                                                                         |

These option shapes need an example:

```ts
Hyperlink.configure({
  protocols: ['ftp', { scheme: 'tel', optionalSlashes: true }],
  isAllowedUri: (uri, ctx) => ctx.defaultValidate(uri) && !uri.includes('blocked.example'),
  shouldAutoLink: (uri) => !uri.startsWith('@')
})
```

`LinkProtocolOptions` is `{ scheme: string; optionalSlashes?: boolean }`.

### `validate` vs `isAllowedUri`

Both are URL gates. Both run at every write boundary — set, edit, paste, input rule, autolink — after the built-in `isSafeHref` gate. Only the signature differs.

- **`validate(url)`** — predates `isAllowedUri`. Use it for a plain URL-to-boolean check, such as "only http(s)" or "block this domain".
- **`isAllowedUri(uri, ctx)`** — Tiptap-canon shape, drop-in compatible with `@tiptap/extension-link` policies. Use it when you port an existing policy, or when you want `ctx.defaultValidate(uri)` to reuse the safety check.

Pick one. Setting both works, because they compose and a URL must pass both, but that is rarely the intent.

`isSafeHref` plus your `validate` and `isAllowedUri` hooks form the composed gate. The package docs use that name.

`validateURL(url, { customValidator })` is a different tool. It is the form-level shape check the prebuilt popovers run before they call a command. It runs `isSafeHref` first, then the shape check, then your `customValidator`.

## Commands

Every command below lands on `editor.commands` and on `editor.chain()`. On `editor.commands`, each returns `boolean`, and `false` marks a no-op.

| Command                                                | Description                                                                                                                                                                                                                               |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setHyperlink({ href, target?, title?, image? })`      | Writes the hyperlink mark over the current selection. Returns `false` when `href` is empty, when the composed gate rejects it, or when the schema cannot apply the mark there.                                                            |
| `unsetHyperlink()`                                     | Removes the mark from the current selection, and extends an empty selection across the whole mark first.                                                                                                                                  |
| `toggleHyperlink({ href, target?, title?, image? })`   | Removes the mark when one is active at the selection, and writes it otherwise. Same gates as `setHyperlink`.                                                                                                                              |
| `setLink` / `unsetLink` / `toggleLink`                 | Aliases that share the canonical implementations, so a policy change reaches both names. They collide with StarterKit's bundled link mark — see [Caveats](#caveats).                                                                      |
| `editHyperlink({ newURL?, newText?, title?, image? })` | Updates any combination of href, inner text, `title`, and `image` on the link at the current selection.                                                                                                                                   |
| `editHyperlinkHref(url)`                               | Shorthand for an href-only edit. Same gates as `editHyperlink`.                                                                                                                                                                           |
| `editHyperlinkText(text)`                              | Shorthand for a text-only edit.                                                                                                                                                                                                           |
| `openCreateHyperlinkPopover(attributes?)`              | Opens the create-link form anchored to the current selection. The command uses `popovers.createHyperlink` when that slot holds a factory, and the prebuilt form otherwise. Returns `false` only when a configured factory returns `null`. |

`editHyperlink` returns `false` (no-op) on four paths, checked in this order:

1. `newURL` fails the shape check, for example `https://googlecom`.
2. The schema carries no mark under that name.
3. No hyperlink mark covers the selection, or the mark at that position cannot be read.
4. The composed gate rejects `newURL`.

The prebuilt edit form closes on path 3, because there is nothing left to edit. It shows an inline error on the other paths and stays open.

`openCreateHyperlinkPopover` opens UI, so `editor.can().openCreateHyperlinkPopover()` reports availability without mounting anything. With nothing selected, the prebuilt form inserts the typed URL as its own link text.

```ts
editor.chain().focus().setHyperlink({ href: 'https://example.com' }).run()
editor.getAttributes('hyperlink').href // read the current href
```

### Links on images

The mark can wrap an inline image when the parent schema permits marks.
For `HyperMultimediaKit`, configure `Image: { inline: true }`, select the image, then call `setHyperlink({ href })`.
Use `editHyperlink({ newURL })` to change its URL without replacing the image with text.
HTML export and import keep the image inside its anchor.

The prebuilt edit form requires link text. Use a host URL form for image-only links.
Block media and custom node views need separate integration checks; they are not covered by this inline-image recipe.

## Keyboard shortcuts

| Shortcut            | Context            | Action                                                                                                                                                        |
| ------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Mod-k`             | `document`         | Opens the create-link form anchored to the current selection.                                                                                                 |
| `ArrowRight`        | `document`         | With `exitable: true`, drops a stored hyperlink mark at the right edge of a link.                                                                             |
| `Escape`            | `popover`          | Hides the popover. Focus stays where it is.                                                                                                                   |
| `Tab` / `Shift-Tab` | `popover`          | Moves focus to the next or previous control inside the popover, and wraps at both ends.                                                                       |
| `Escape`            | `create-link form` | Hides the popover and returns focus to the editor from the URL field. From the Apply button the shell handler hides the popover and leaves focus where it is. |
| `Escape`            | `edit-link form`   | Hides the popover and returns focus to the editor from any control.                                                                                           |

The shell binds `Escape` on the popover root, and `Tab` on each control inside it. Both keys therefore need focus inside the popover. The preview popover takes no focus when it opens, so dismiss it with an outside click.

The mark runs at `priority: 1000`, above the Tiptap default `100`. `@tiptap/extension-link` binds no keyboard shortcut, so `Mod-k` is never contested. The two marks do collide on commands and on the `a[href]` parse rule — see [Caveats](#caveats).

## Caveats

- **`StarterKit.configure({ link: false })` is required, not stylistic.** StarterKit v3 bundles `@tiptap/extension-link` by default. Both marks sit at `priority: 1000`, and Tiptap merges every `addCommands()` into one flat map. `setLink` / `unsetLink` / `toggleLink` then resolve to whichever mark comes later in your `extensions` array, with no warning. Both marks also claim the `a[href]` parse rule, and ProseMirror applies only the first match: one mark takes every anchor and the other never parses. If the upstream mark wins, this package's [`isSafeHref`](./security.md) gate never runs on parsed or pasted HTML, and its popovers never attach.
- **A click on a link needs `popovers.previewHyperlink`.** The three openers fall back to the prebuilt factory when a slot is `null`. The click handler does not: leave `previewHyperlink` at `null` and a click on a link opens no popover.
- **`linkOnPaste: false` does not stop every paste from linking.** The option gates the paste-over-selection plugin alone. The linkify paste rule stays registered, so a pasted bare URL still becomes a link. To stop that path too, set `shouldAutoLink: () => false`, which every autolink path consults.
- **The markdown `[text](url)` input rule is always on.** No option turns it off, so typing a literal `[a](b)` writes a link. Remove it afterwards with `editor.commands.unsetHyperlink()`. See [Markdown](./url-handling.md#markdown).
- **`HTMLAttributes.target` reaches the DOM.** The mark attribute `target` carries `rendered: false`, so a stored `_blank` never renders. The option object is merged separately in `renderHTML`, so `HTMLAttributes: { target: '_blank' }` does emit `<a target="_blank">`. A browser-driven `target="_blank"` navigation skips the click gate, which is the risk the mark-level `rendered: false` exists to block. Leave `target` at `null` and let the click handler open the link.
- **The mark name is fixed at `hyperlink`.** Stored documents and the markdown wiring both key on it. `openPreviewHyperlink`, `openEditHyperlink`, and `openCreateHyperlink` throw when no extension answers to that name. Do not rename the mark.
- **[`getDefaultController()`](./advanced.md#ui-controller) owns one controller per bundle, not one per page.** A host that also loads `@docs.plus/extension-hypermultimedia` gets two controllers. Opening a popover in one package does not dismiss the popover of the other. Close the other popover yourself when you open one.

## Server bundles

Module scope touches no browser API, so a server bundle can import the package. [`createPopover`](./advanced.md#floating-popover-primitive), [the three openers](./popovers.md#openers), the three prebuilt popover factories, `attachTooltip`, `createHTMLElement`, and `copyToClipboard` read `document` or `navigator`, so call them in the browser only.

## TypeScript

The package bundles the type definitions. The complete public surface, grouped by role:

- **Extension** — `Hyperlink`, also the default export. Types `HyperlinkOptions`, `HyperlinkAttributes`, `HyperlinkStorage`, `HyperlinkPublicCommands`, `SetHyperlinkAttributes`, `EditHyperlinkAttributes`, `IsAllowedUriContext`, `LinkProtocolOptions`. `HyperlinkAttributes` is generic. `HyperlinkAttributes<{ ariaLabel: string }>` extends the built-in `href` / `target` / `rel` / `class` / `title` / `image` keys with your own typed fields. The default parameter is `Record<string, unknown>`, so the unparameterized type stays open; supplying your own `Extra` replaces it and closes the type.
- **Popover factories** — `previewHyperlinkPopover`, `createHyperlinkPopover`, `editHyperlinkPopover`. Types `PreviewHyperlinkOptions`, `CreateHyperlinkOptions`, `EditHyperlinkOptions`, documented under [Popover-factory option shapes](./popovers.md#popover-factory-option-shapes).
- **Openers** — `openPreviewHyperlink`, `openEditHyperlink`, `openCreateHyperlink`, `buildPreviewOptionsFromAnchor`. Type `BuildPreviewOptionsFromAnchorArgs`. See [Openers](./popovers.md#openers).
- **Floating-popover primitive** — `createPopover`, `DEFAULT_OFFSET`. Types `Popover`, `PopoverOptions`. See [Floating-popover primitive](./advanced.md#floating-popover-primitive).
- **UI controller** — `getDefaultController`. Types `PopoverController`, `PopoverKind`, `ControllerState`, `AdoptMetadata`, `VirtualCoordinates`. See [UI controller](./advanced.md#ui-controller).
- **Tooltip primitive** — `attachTooltip`, `hideTooltip`, re-exported from the bundled `@docs.plus/floating-tooltip`. See [Tooltip primitive](./advanced.md#tooltip-primitive).
- **URL utilities** — `normalizeHref`, `getSpecialUrlInfo`, `validateURL`, `isSafeHref`, `DANGEROUS_SCHEME_RE`, `SAFE_WINDOW_FEATURES`. Types `SpecialUrlInfo`, `SpecialUrlType`, `LinkifyMatchLike`, `ValidateURLOptions`.
- **DOM helpers** — `copyToClipboard(text, callback?)` writes `text` to the clipboard and reports success through `callback`. `createHTMLElement(tag, props?)` builds one element and assigns `props` onto it. The SVG icon factories `Copy`, `LinkOff`, `Pencil` take `IconProps`. The prebuilt preview toolbar renders those three icons; reuse them for visual parity.
- **Linkify re-export** — `registerCustomProtocol`, passed through from [linkifyjs](https://linkify.js.org).
