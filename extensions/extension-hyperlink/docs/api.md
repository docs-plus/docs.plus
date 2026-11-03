# API reference

Part of the [`@docs.plus/extension-hyperlink` README](../README.md).

## Options

Every key below goes into `Hyperlink.configure({ … })`.

| Option                 | Type                                                                                                                                                                                                                                                                 | Default                                                                  | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `autolink`             | `boolean`                                                                                                                                                                                                                                                            | `true`                                                                   | Converts URLs to links as you type. The mark is never inclusive, so text typed at either edge of a link stays plain.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `openOnClick`          | `boolean`                                                                                                                                                                                                                                                            | `true`                                                                   | Gates the whole click plugin. Primary click opens the preview popover, and Mod-click opens the link in a new tab. With no `popovers.previewHyperlink`, a read-only editor opens the link through `navigate` with `newTab: false`, and an editable editor opens no popover. `false` removes every pointer handler the package binds, including the click guard and the middle-click gate. It also removes Mod-click, the Mod cursor, the `hyperlink-click-scope` class and read-only `Enter` on a link. `Mod-k` and `Alt-Enter` are keymaps, so `openOnClick` does not gate them. |
| `linkOnPaste`          | `boolean`                                                                                                                                                                                                                                                            | `true`                                                                   | Wraps a non-empty selection in a link when the clipboard holds exactly one URL. It gates that path only — a pasted bare URL still autolinks at `false`. See [Caveats](#caveats).                                                                                                                                                                                                                                                                                                                                                                                                 |
| `protocols`            | `Array<LinkProtocolOptions \| string>`                                                                                                                                                                                                                               | `[]`                                                                     | Extra schemes registered with [linkifyjs](https://linkify.js.org), which is what makes paste detect them. Each scheme registers once per process. The built-in catalog is separate and registers nothing with linkifyjs. See [URL handling](./url-handling.md).                                                                                                                                                                                                                                                                                                                  |
| `HTMLAttributes`       | `Partial<HyperlinkAttributes>`                                                                                                                                                                                                                                       | `{ target: null, rel: 'noopener noreferrer nofollow', class: null }`     | Attributes merged onto every rendered `<a>`. A `null` value renders nothing, so the default anchor carries `rel` only. A `target` set here does reach the DOM — see [Caveats](#caveats).                                                                                                                                                                                                                                                                                                                                                                                         |
| `popovers`             | `{ previewHyperlink?: ((options: PreviewHyperlinkOptions) => HTMLElement \| null) \| null; editHyperlink?: ((options: EditHyperlinkOptions) => HTMLElement \| null) \| null; createHyperlink?: ((options: CreateHyperlinkOptions) => HTMLElement \| null) \| null }` | `{ previewHyperlink: null, editHyperlink: null, createHyperlink: null }` | One factory per popover slot. The three openers fall back to the prebuilt factory when a slot is `null`. The click handler does not: leave `previewHyperlink` at `null` and a click on a link opens no popover. A factory that returns `null` opts out of that popover. See [Popovers](./popovers.md).                                                                                                                                                                                                                                                                           |
| `validate`             | `(url: string) => boolean`                                                                                                                                                                                                                                           | `undefined`                                                              | URL gate at every write boundary, after `isSafeHref`. Return `false` to reject. See [`validate` vs `isAllowedUri`](#validate-vs-isalloweduri).                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `defaultProtocol`      | `string`                                                                                                                                                                                                                                                             | `'https'`                                                                | Scheme used when promoting bare domains (`example.com` → `${defaultProtocol}://example.com`). See [URL handling](./url-handling.md).                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `isAllowedUri`         | `(uri: string, ctx: IsAllowedUriContext) => boolean`                                                                                                                                                                                                                 | `undefined`                                                              | URL gate, Tiptap-canon shape. Same write boundaries as `validate`; `ctx` carries `{ defaultValidate, protocols, defaultProtocol }`. See [`validate` vs `isAllowedUri`](#validate-vs-isalloweduri).                                                                                                                                                                                                                                                                                                                                                                               |
| `shouldAutoLink`       | `(uri: string) => boolean`                                                                                                                                                                                                                                           | `undefined`                                                              | Per-URI autolink veto. The autolink plugin, the paste handler, and the linkify paste rule all consult it. An explicit `setHyperlink` write skips it, because that is user intent.                                                                                                                                                                                                                                                                                                                                                                                                |
| `enableClickSelection` | `boolean`                                                                                                                                                                                                                                                            | `false`                                                                  | With `true`, a click inside a link in an editable editor selects the whole mark range. That expansion also needs a collapsed selection. Every other case places the caret at the clicked position, and keeps a non-empty selection only when it overlaps the link. A read-only editor is one of those cases. All paths need a mounted preview popover, so with an empty `popovers.previewHyperlink` slot the package writes no selection at all. Mirrors `@tiptap/extension-link`.                                                                                               |
| `exitable`             | `boolean`                                                                                                                                                                                                                                                            | `false`                                                                  | With `true`, ArrowRight at the end of a link drops a stored hyperlink mark, such as one `setHyperlink` leaves on a collapsed caret. Text typed at the right edge is plain either way, because the mark is never inclusive.                                                                                                                                                                                                                                                                                                                                                       |
| `linkIcon`             | `(ctx: LinkIconContext) => HTMLElement \| null`                                                                                                                                                                                                                      | `undefined`                                                              | Draws an icon at the start of every `<a>`. Sync: return a fresh element with no text, or `null` for a plain link. Unset means the default `<a>`. See [Link icons](#link-icons).                                                                                                                                                                                                                                                                                                                                                                                                  |
| `navigate`             | `(href: string, ctx: { newTab: boolean }) => void`                                                                                                                                                                                                                   | `undefined`                                                              | Opens a link: the middle click, Mod-click, `Alt-Enter`, the read-only click with no preview slot, the prebuilt preview's Open and the hovercard title. The package calls it only after the composed gate passes. `newTab` is `true` only when the gesture asked for a new tab: Mod-click, or a middle click on a link, the preview's Open or the hovercard title. Every other open passes `false`, and the host chooses. Unset means `window.open(href, '_blank', 'noopener,noreferrer')`, whatever `newTab` says.                                                               |
| `hovercard`            | `HovercardOptions`                                                                                                                                                                                                                                                   | `undefined`                                                              | Shows a read-only card when a mouse pointer rests on a link. Unset means no card. Import `hovercard.css` with it. See [Hovercard](#hovercard).                                                                                                                                                                                                                                                                                                                                                                                                                                   |

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

`validateURL(url, { customValidator })` is a different tool. It is the form-level shape check the prebuilt popovers run before they call a command. It runs `isSafeHref` first, then the shape check, then your `customValidator`. The value must be one whole link: a sentence or a raw space is refused, and trailing punctuation such as `google.com.` still passes the check. `wholeLink(url, { customValidator })` runs the same check and returns the link to store, without that punctuation, or `null`. A custom popover stores `normalizeHref(wholeLink(value))`, as the prebuilt ones do.

### Link icons

An iconed link has this DOM:

```html
<a href="https://example.com" rel="noopener noreferrer nofollow">
  <span class="hyperlink-icon" contenteditable="false" aria-hidden="true"></span>
  <span>link text</span>
</a>
```

- Only hrefs that pass `isSafeHref` reach `linkIcon`. An unsafe href renders blank, with no icon.
- The function runs once per rendered `<a>`. A `title` or `image` write keeps the same `<a>` and icon, and a new href draws a new one.
- The icon starts every iconed `<a>`, image-led and image-only links included. A mark view gets no content, so it cannot place the icon after an image.
- Serializers use the mark's `toDOM`, so no icon reaches `getHTML()`, Markdown, copy or drag.
- A parse rule ignores `.hyperlink-icon`, so a paste or a native split never turns an icon into an Image node.
- The package sets `aria-hidden="true"` on the icon, so screen readers read only the link text. An icon with its own non-empty `aria-label` is the exception. It gets `role="img"` and stays exposed, so a host can speak a link's kind.
- An icon click puts the caret at the link start.
- At a link that starts its block, the caret shows after the icon, but typed text lands before the link. This is a deliberate exception to Google Docs, Word and Notion, whose links carry no icon.
- The clean-room tests run on `prosemirror-view` 1.42.6, the version `@tiptap/pm` 3.32.0 asks for.
- With `linkIcon` unset, the package still registers a mark view, which draws the same `<a>` as `renderHTML`.

#### `linkIconMap` and `linkIconFetcher`

Two helpers build a `linkIcon` function. Building one creates no DOM and starts no request. Only the returned function does, when the mark view calls it.

```ts
linkIconMap(entries: Record<string, string | { light: string; dark: string } | (() => HTMLElement)>):
  (ctx: LinkIconContext) => HTMLElement | null

linkIconFetcher(options: { src: (origin: string) => string; tile?: boolean }):
  (ctx: LinkIconContext) => HTMLElement | null
```

Chain them with `??`. The first non-null result wins, so a map hit never reaches the fetcher helper:

```ts
const icons = linkIconMap({ 'example.com': '/icons/example.svg' })
const favicons = linkIconFetcher({
  src: (origin) => `/favicon?origin=${encodeURIComponent(origin)}`
})
Hyperlink.configure({ linkIcon: (ctx) => icons(ctx) ?? favicons(ctx) })
```

`linkIconMap(entries)` is an offline table. The package ships no entries, so it holds only your own table. Each key is a bare hostname:

- Only `http:` and `https:` hrefs match.
- `www.` and a trailing dot are ignored on the key and on the href.
- A subdomain matches its parent key, and the longest key wins. `docs.example` matches `https://a.docs.example`.
- A host that no key names gets `null`. `docs.example` does not match `evildocs.example` or `docs.example.evil.example`.
- IDN keys become punycode, like hrefs.
- A key with `/`, `:`, `?`, `#`, `@`, `*`, `%` or a space throws a `TypeError`. A key holds no scheme, port, path or wildcard.
- When two keys name one host, the later key wins. No error is thrown.

Each entry gives one kind of icon:

- **An image URL** gives an `<img>`. It stays hidden until it loads, so a missing image leaves the link plain.
- **A `{ light, dark }` pair** gives an empty `<span>` with `background-image: light-dark(url(light), url(dark))`. It follows the app's `color-scheme`, with no listener. Browsers without the image form of `light-dark()` show the light image.
- **A function** is called once per link and must return a fresh element with no text.

`linkIconFetcher({ src, tile })` builds one `<img>` per link. It calls `src` with the link's origin, never the path, and returns `null` for any href that is not `http:` or `https:`.

- Every link on one origin gets the same image URL, so the browser HTTP cache makes one request per origin.
- The `<img>` stays hidden until it loads. An icon that is already in the cache shows at once when a link is drawn again.
- `tile: true` adds the `hyperlink-icon-tile` class to every icon it returns. `styles.css` then puts a light square behind the icon on a dark `color-scheme`. The default is `false`.

Each helper keeps its own set of image URLs that failed once. It never requests one of those URLs again, so a known miss costs no request.

**Privacy.** `linkIconFetcher` sends the origin of every link to your `src` endpoint, from the reader's browser, when the document opens. If `src` points at a third party, that party sees the reader's IP address and every linked origin.

### Hovercard

The `hovercard` option shows a read-only card when a mouse pointer rests on a link. The card shows the host's data: a picture, the link's host name, a title and a description. The package makes no request of its own.

```ts
import { Hyperlink } from '@docs.plus/extension-hyperlink'
import '@docs.plus/extension-hyperlink/hovercard.css'

Hyperlink.configure({
  hovercard: {
    fetchMetadata: async ({ href }) => {
      const res = await fetch(`/metadata?url=${encodeURIComponent(href)}`)
      return res.ok ? res.json() : null
    }
  }
})
```

`HovercardOptions`:

| Field           | Type                                                          | Description                                                                                                                                        |
| --------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fetchMetadata` | `(ctx: { href: string }) => Promise<HovercardData \| null>`   | **Required.** Returns the card data. `null`, a rejection or a throw shows no card.                                                                 |
| `siteIcon?`     | `(ctx: { href: string }) => HTMLElement \| null`              | The icon before the host name. Same contract as `linkIcon`: a fresh element with no text, or `null`. A throw shows no icon and logs once.          |
| `shouldShow?`   | `(ctx: { href: string; link: HTMLAnchorElement }) => boolean` | Return `false` to show no card for this link. It runs before any request. A throw shows no card and logs once per editor.                          |
| `imageLayout?`  | `'cover' \| 'adaptive'`                                       | `'cover'` (default) puts the picture in a full-width 1.91:1 well. `'adaptive'` uses a 64px thumbnail beside the text for some pictures, see below. |

`HovercardData` is `{ title: string; description?: string; image?: { url: string; width?: number; height?: number } }`. The card loads exactly `image.url`, so route pictures through your own server when privacy matters. An empty `title` shows the href.

- **Timing.** The request starts after the pointer rests on the link for 150 ms, so a pointer that only passes over a link sends none. The card opens 500 ms after the pointer enters, at the earliest. It waits up to 300 ms after the data for the picture. It closes 300 ms after the pointer leaves both the link and the card.
- **Leaving cancels the open, not the request.** The request runs on, so a host cache can serve the next hover or click.
- **Keys.** A bare Shift, Control, Alt, Meta, AltGraph or CapsLock keeps the card open. So do the arrow keys, Home, End, PageUp, PageDown, F1 to F12 and Mod-C. Every other key closes it. A press outside the card and `compositionstart` close it too.
- **Gates.** The card shows only for a mouse on a `(hover: hover) and (pointer: fine)` device, and never while a mouse button is down. A link must pass the composed gate before `shouldShow` runs. A link with no `hyperlink` mark, such as an embed's own anchor, gets no card.
- **Other popovers win.** No card opens while another popover of this bundle is mounted, such as the preview, create or edit popover. The card closes only its own popover. See [Caveats](#caveats).
- **Adaptive layout.** With `'adaptive'`, a picture under 1.3:1 or under 320px wide becomes the thumbnail. `image.width` and `image.height` decide when the host sends both. Otherwise the decoded picture decides, and a picture still loading at open uses `'cover'`.
- **A late picture.** A picture that loads after open fades in. A cover picture that fails after open folds its well away. A thumbnail that fails fades out in place, so the text never moves.
- **Safety.** Title and description are set with `textContent`. Pictures load with `referrerPolicy: 'no-referrer'`. A click on the title opens the link through `navigate`, with `newTab: true` only when Mod is held. A middle click on the title also goes through `navigate`, with `newTab: true`.
- **Lifecycle.** The card is a ProseMirror plugin, and its popover kind is `'hovercard'`. Every listener and timer lives in the plugin view, so `editor.destroy()` removes them and leaves other editors alone.

The card's CSS ships as its own file, `hovercard.css`. See [Styling](./styling.md#hovercard).

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

| Shortcut            | Context            | Action                                                                                                                                                                                                                                             |
| ------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Mod-k`             | `document`         | With a collapsed caret strictly inside a link, opens that link's preview, with focus inside it. This needs `popovers.previewHyperlink`; with no slot it does nothing. Anywhere else, opens the create-link form anchored to the current selection. |
| `Alt-Enter`         | `document`         | With a collapsed caret strictly inside a link, opens the link through `navigate` with `newTab: false`. A refused link still uses up the key, so Enter never splits the link.                                                                       |
| `Enter`             | read-only link     | In a read-only editor, Enter on a focused link opens its preview, with focus inside it. This needs `popovers.previewHyperlink`; with no slot it opens the link through `navigate` with `newTab: false`.                                            |
| `ArrowRight`        | `document`         | With `exitable: true`, drops a stored hyperlink mark at the right edge of a link.                                                                                                                                                                  |
| `Escape`            | `popover`          | Hides the popover. Focus stays where it is, except for a preview opened from the keyboard: see below.                                                                                                                                              |
| `Tab` / `Shift-Tab` | `popover`          | Moves focus to the next or previous control inside the popover, and wraps at both ends. It skips a control that is disabled, inside `[inert]`, not rendered, or at `tabindex="-1"`.                                                                |
| `Escape`            | `create-link form` | Hides the popover and returns focus to the editor from the URL field. From the Apply button the shell handler hides the popover and leaves focus where it is.                                                                                      |
| `Escape`            | `edit-link form`   | Hides the popover and returns focus to the editor from any control.                                                                                                                                                                                |

The shell binds `Escape` and `Tab` on the popover root, so both keys need focus inside the popover. The shell reads the Tab cycle on each press, so a control that renders after the popover opens joins it. A preview opened by a click takes no focus, so dismiss it with an outside click. A preview opened by `Mod-k`, or by read-only `Enter`, moves focus inside. Focus goes to the element with the `data-popover-autofocus` attribute, else the first control that Tab visits, else the popover root. The prebuilt preview sets no `data-popover-autofocus`, so its first control takes focus. When that preview closes and focus would be lost, focus goes back to the editor at the same caret, or to the read-only link. Focus that the user moved elsewhere stays where it is.

The mark runs at `priority: 1000`, above the Tiptap default `100`. `@tiptap/extension-link` binds no keyboard shortcut, so `Mod-k` is never contested. The two marks do collide on commands — see [Caveats](#caveats). The `a[href]` parse rule of this package runs at priority 51, above the ProseMirror default of 50, so it wins over Link's rule.

## Caveats

- **`StarterKit.configure({ link: false })` is required, not stylistic.** StarterKit v3 bundles `@tiptap/extension-link` by default. Both marks sit at `priority: 1000`, and Tiptap merges every `addCommands()` into one flat map. `setLink` / `unsetLink` / `toggleLink` then resolve to whichever mark comes later in your `extensions` array, with no warning. Both marks also claim the `a[href]` parse rule. This package's rule runs at priority 51, so it takes every anchor that [`isSafeHref`](./security.md) accepts. A host that keeps Link only to load stored `link` marks still gets `hyperlink` from parsed and pasted HTML. An anchor that `isSafeHref` rejects falls through to Link's own rule.
- **A click on a link, and `Mod-k` inside a link, need `popovers.previewHyperlink`.** The three openers fall back to the prebuilt factory when a slot is `null`. The click handler and `Mod-k` do not. Leave `previewHyperlink` at `null`, and a click on a link opens no popover. `Mod-k` inside a link then does nothing, and it never opens the create form there.
- **`linkOnPaste: false` does not stop every paste from linking.** The option gates the paste-over-selection plugin alone. The linkify paste rule stays registered, so a pasted bare URL still becomes a link. To stop that path too, set `shouldAutoLink: () => false`, which every autolink path consults.
- **The markdown `[text](url)` input rule is always on.** No option turns it off, so typing a literal `[a](b)` writes a link. Remove it afterwards with `editor.commands.unsetHyperlink()`. See [Markdown](./url-handling.md#markdown).
- **`HTMLAttributes.target` reaches the DOM.** The mark attribute `target` carries `rendered: false`, so a stored `_blank` never renders. The option object is merged separately in `renderHTML`, so `HTMLAttributes: { target: '_blank' }` does emit `<a target="_blank">`. A browser-driven `target="_blank"` navigation skips the click gate, which is the risk the mark-level `rendered: false` exists to block. Leave `target` at `null` and let the click handler open the link.
- **Markdown keeps only the link `href`.** Export writes `[text](href)`, and import reads the href alone, so a link `title` is lost both ways. A custom `rel` is lost too, and import sets the default `rel`. `target`, `class` and `image` never reach Markdown, by design. See [Markdown](./url-handling.md#markdown).
- **The mark name is fixed at `hyperlink`.** Stored documents and the markdown wiring both key on it. `openPreviewHyperlink`, `openEditHyperlink`, and `openCreateHyperlink` throw when no extension answers to that name. Do not rename the mark.
- **[`getDefaultController()`](./advanced.md#ui-controller) owns one controller per bundle, not one per page.** A host that also loads `@docs.plus/extension-hypermultimedia` gets two controllers. Opening a popover in one package does not dismiss the popover of the other. Close the other popover yourself when you open one.
- **A link icon needs CSS for `.hyperlink-icon`.** Without `styles.css` or your own rule, the icon shows at its natural size. A Tailwind host also breaks the line, because preflight sets `img` and `svg` to `display: block`. See [Styling](./styling.md).
- **`linkIcon` must return a fresh element with no text.** An element that already has a parent, an element with text, any other non-null value, or a throw gives a plain link. The package logs one console error per `linkIcon` function, not one per link.
- **A host mark above `priority: 1000` splits one link into two icons.** That mark renders outside the link. When it covers part of a link, the `<a>` splits in two, and each part gets an icon.
- **`Hyperlink.extend({ addMarkView })` replaces the icon mark view.** Tiptap gives no warning. To keep the icon, call `this.parent?.()` and wrap its result.
- **Legacy `link` marks get no icon.** Only the `hyperlink` mark renders through the icon mark view.
- **A `{ light, dark }` pair has limits.** It needs `styles.css` or your own `.hyperlink-icon` size, or the span has zero width. A bad URL shows a blank 1em box. Browsers before Chrome 150, Firefox 150 and Safari 27 show the light image.
- **A transient image failure hides that icon until reload.** The helper does not request a failed URL again.
- **A pointer already resting on a link gets no hovercard.** The card starts only on `pointerover`. When a link renders under a still pointer, no card shows until the pointer leaves the link and comes back.
- **The hovercard sees only this bundle's popovers.** It opens no card while a preview, create or edit popover of this package is mounted. A popover from another bundle does not stop it, for the reason in the [`getDefaultController()`](./advanced.md#ui-controller) caveat above.

## Server bundles

Module scope touches no browser API, so a server bundle can import the package. [`createPopover`](./advanced.md#floating-popover-primitive), [the three openers](./popovers.md#openers), the three prebuilt popover factories, `attachTooltip`, `createHTMLElement`, and `copyToClipboard` read `document` or `navigator`, so call them in the browser only. Building `linkIconMap` or `linkIconFetcher` is safe on a server, but the functions they return create DOM, so call those in the browser only.

## TypeScript

The package bundles the type definitions. The complete public surface, grouped by role:

- **Extension** — `Hyperlink`, also the default export. Types `HyperlinkOptions`, `HyperlinkAttributes`, `HyperlinkStorage`, `HyperlinkPublicCommands`, `SetHyperlinkAttributes`, `EditHyperlinkAttributes`, `IsAllowedUriContext`, `LinkProtocolOptions`, `LinkIconContext` (the `linkIcon` argument, `{ href: string }`), and `HovercardOptions`, `HovercardData`, `HovercardImageLayout` (see [Hovercard](#hovercard)). Link-icon helpers `linkIconMap` and `linkIconFetcher`, see [`linkIconMap` and `linkIconFetcher`](#linkiconmap-and-linkiconfetcher). `HyperlinkAttributes` is generic. `HyperlinkAttributes<{ ariaLabel: string }>` extends the built-in `href` / `target` / `rel` / `class` / `title` / `image` keys with your own typed fields. The default parameter is `Record<string, unknown>`, so the unparameterized type stays open; supplying your own `Extra` replaces it and closes the type.
- **Popover factories** — `previewHyperlinkPopover`, `createHyperlinkPopover`, `editHyperlinkPopover`. Types `PreviewHyperlinkOptions`, `CreateHyperlinkOptions`, `EditHyperlinkOptions`, documented under [Popover-factory option shapes](./popovers.md#popover-factory-option-shapes).
- **Openers** — `openPreviewHyperlink`, `openEditHyperlink`, `openCreateHyperlink`, `buildPreviewOptionsFromAnchor`. Type `BuildPreviewOptionsFromAnchorArgs`. See [Openers](./popovers.md#openers). `linkAtSelection(state, markType)` returns `{ from, to, href }` when a collapsed caret sits strictly inside one link, and `null` otherwise. `Mod-k` and `Alt-Enter` use it. A host keymap can use it too, for example a chat composer that must not send on `Alt-Enter` over a link.
- **Key helper** — `hasMod(event, isMac?)` is `true` when the platform Mod key is held: Cmd on macOS, Ctrl elsewhere. `isMac` defaults to the current platform. A host can use it to match the package's Mod-click rule.
- **Floating-popover primitive** — `createPopover`, `DEFAULT_OFFSET`. Types `Popover`, `PopoverOptions`. See [Floating-popover primitive](./advanced.md#floating-popover-primitive).
- **UI controller** — `getDefaultController`. Types `PopoverController`, `PopoverKind`, `ControllerState`, `AdoptMetadata`, `VirtualCoordinates`. See [UI controller](./advanced.md#ui-controller).
- **Tooltip primitive** — `attachTooltip`, `hideTooltip`, re-exported from the bundled `@docs.plus/floating-tooltip`. See [Tooltip primitive](./advanced.md#tooltip-primitive).
- **URL utilities** — `normalizeHref`, `getSpecialUrlInfo`, `validateURL`, `wholeLink`, `isSafeHref`, `DANGEROUS_SCHEME_RE`, `SAFE_WINDOW_FEATURES`. Types `SpecialUrlInfo`, `SpecialUrlType`, `LinkifyMatchLike`, `ValidateURLOptions`.
- **DOM helpers** — `copyToClipboard(text, callback?)` writes `text` to the clipboard and reports success through `callback`. `createHTMLElement(tag, props?)` builds one element and assigns `props` onto it. The SVG icon factories `Copy`, `LinkOff`, `Pencil` take `IconProps`. The prebuilt preview popover renders those three icons; reuse them for visual parity.
- **Linkify re-export** — `registerCustomProtocol`, passed through from [linkifyjs](https://linkify.js.org).
