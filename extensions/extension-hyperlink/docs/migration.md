# Migration

Part of the [`@docs.plus/extension-hyperlink` README](../README.md).

- [Migrating from 2.2 to 2.3](#migrating-from-22-to-23)
- [Migrating from 1.x](#migrating-from-1x)

## Migrating from 2.2 to 2.3

`2.3` is a minor release. No export or option was removed, and stored JSON and Yjs documents load as before. HTML loads with two differences: the `<a href>` parse rule and the `.hyperlink-icon` parse rule below. Some defaults changed, so check each item below that your app depends on. The [CHANGELOG](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hyperlink/CHANGELOG.md) has one entry for each item.

This guide lists only what can break. New in 2.3, and opt-in: the `linkIcon`, `hovercard`, `pasteTitle` and `navigate` options, and the `toStoredLink`, `linkAtSelection`, `linkIconMap`, `linkIconFetcher` and `hasMod` exports. Each is a root export of `@docs.plus/extension-hyperlink`. The CHANGELOG `Added` list has the rest.

Two gates appear below. A write passes the composed gate: `isSafeHref`, your `validate` and your `isAllowedUri`. An open passes the read gate: `isSafeHref` and your `isAllowedUri`. `validate` never runs on an open. See [`validate` vs `isAllowedUri`](./api.md#validate-vs-isalloweduri).

No new stylesheet import is needed to keep 2.2 behaviour. Import `hovercard.css` only when you add the `hovercard` option. The link icon rules ship in `styles.css`.

### Dependencies

**Tiptap peer floor.** `@tiptap/core` and `@tiptap/pm` must be `^3.32.2`. They were `^3.31.3`.

```sh
npm install @tiptap/core@^3.32.2 @tiptap/pm@^3.32.2
npm ls @tiptap/core @tiptap/pm
```

**`linkifyjs`.** The runtime dependency is now `^4.4.0`. It was `^4.3.3`. Each copy of linkifyjs keeps its own scheme registry. If your app imports `linkifyjs` too, widen its range to `^4.4.0`, so a scheme your app registers reaches the copy this package uses. Then check for one copy:

```sh
npm ls linkifyjs
```

### URL checks and the link forms

**`validateURL` accepts only one whole link.** A sentence such as `hello google.com` is now refused, and so is a raw space in any scheme. Trailing punctuation such as `google.com.` still passes. If your own form stores the field value after `validateURL`, it keeps that punctuation. Store the value from `toStoredLink` instead, as the prebuilt forms do:

```ts
import { toStoredLink, validateURL } from '@docs.plus/extension-hyperlink'

// 2.2
const url = input.value.trim()
if (!validateURL(url, { customValidator: validate })) return
editor.chain().setHyperlink({ href: url }).run() // `google.com,` kept its comma

// 2.3
const url = toStoredLink(input.value, { customValidator: validate })
if (!url) return
editor.chain().setHyperlink({ href: url }).run() // `google.com,` stores https://google.com
```

`setHyperlink` normalizes the value, so `google.com` is stored as `https://google.com`.

**`customValidator` gets the value the form stores.** That value is trimmed, without trailing punctuation, and keeps a leading `//`. In 2.2, an app link or a phone reached it as raw input, and a web link as linkify's match. The prebuilt forms pass your `validate` option as `customValidator`, so this applies to `validate` too:

```ts
// 2.2: `whatsapp://send?text=hi.` reached `validate` with its dot.
// 2.3: the same input reaches it as `whatsapp://send?text=hi`.
Hyperlink.configure({ validate: (url) => !url.includes('blocked.example') })
```

A rule that reads the value as the user typed it, such as one that refuses a trailing dot, no longer sees that dot. The write gate is unchanged. It still calls `validate` with the normalized href. So one submit of `google.com` calls `validate` with `google.com`, and again with `https://google.com`. One submit calls `validate` more than once, as in 2.2. Only the typed value is new. So a rule must pass both the typed value and the normalized href, and give the same answer each time. Autolink and paste call it with the normalized href only.

### Clicks and keys

**Mod-click opens a new tab.** Cmd-click on macOS, or Ctrl-click elsewhere, opens the link through `navigate` with `newTab: true`, and opens no preview. In 2.2 it opened the preview, like a plain click. No option restores the old behaviour. Mod-click works the same in a read-only editor. With `openOnClick: false`, the package handles no click on a link, Mod-click included. Check any test or tour that Mod-clicks a link to open the preview.

With `navigate` unset, every open of the package calls `window.open(href, '_blank', 'noopener,noreferrer')`, whatever `newTab` says. That covers Mod-click, `Alt-Enter`, read-only Enter and click, the preview's Open and the hovercard title. Set `navigate` to route an open in your app. It gets only `href` and `{ newTab }`. See the example under the read-only click below.

**`Mod-k` inside a link opens the preview.** With a collapsed caret strictly inside a link, `Mod-k` opens that link's preview, with focus inside it. Strictly inside means link text sits on both sides of the caret. In `docs|.plus` the caret is inside. In `|docs.plus` or `docs.plus|` it sits at an edge. Two touching links count as an edge. At an edge, outside a link, or with a non-empty selection, it still opens the create form. Any factory in the slot works, not only the prebuilt one. With `popovers.previewHyperlink` unset, `Mod-k` inside a link does nothing. Set the slot so the key has a result:

```ts
import { Hyperlink, previewHyperlinkPopover } from '@docs.plus/extension-hyperlink'

Hyperlink.configure({ popovers: { previewHyperlink: previewHyperlinkPopover } })
```

**`Alt-Enter` inside a link opens the link.** As with `Mod-k`, the caret must sit strictly inside the link. The package opens it through `navigate`, with `newTab: false`. It uses up the key even when the gate refuses the link. So a keymap below the mark's priority of `1000` no longer gets `Alt-Enter` with the caret inside a link. To act first, give your extension a priority above `1000`. Then test the caret with `linkAtSelection`, and return `false` inside a link so the link still opens. For example, a chat composer that sends on `Alt-Enter`:

```ts
import { Extension } from '@tiptap/core'
import { linkAtSelection } from '@docs.plus/extension-hyperlink'

const SendOnAltEnter = Extension.create({
  name: 'sendOnAltEnter',
  // Above the mark's 1000, so this keymap runs first.
  priority: 1001,
  addKeyboardShortcuts() {
    return {
      'Alt-Enter': () => {
        const type = this.editor.schema.marks.hyperlink
        // Inside a link, let the link open. Elsewhere, send.
        if (type && linkAtSelection(this.editor.state, type)) return false
        return send(this.editor)
      }
    }
  }
})
```

`send` stands for your own send function. Drop the `linkAtSelection` test if `Alt-Enter` must send even inside a link.

**In a read-only editor, Enter on a focused link moves focus into its preview.** In 2.2, Enter opened the preview as a click does, but focus stayed on the link. Now focus moves into the preview, and Escape returns it to the link. With no preview slot, Enter opens the link through `navigate` with `newTab: false`, as a click does. With `navigate` unset, both open a new tab. Check any read-only keyboard handling of your own on links.

**A read-only click with no preview slot ignores the link's `target`.** It goes through `navigate` with `newTab: false`. With `navigate` unset, it always opens a new tab. In 2.2 the link's `target` decided, with `_blank` as the fallback. To open a plain click in the same tab, set `navigate`. It handles every open of the package. So `Alt-Enter`, a plain click on the preview's Open and the hovercard title then open in the same tab too. In an editable editor, a same-tab open leaves the page.

```ts
import { Hyperlink, SAFE_WINDOW_FEATURES } from '@docs.plus/extension-hyperlink'

Hyperlink.configure({
  // The package calls this only after the read gate allows the href.
  navigate: (href, { newTab }) => {
    if (newTab) window.open(href, '_blank', SAFE_WINDOW_FEATURES)
    else window.location.assign(href)
  }
})
```

**The prebuilt preview's Open also applies the editor's `isAllowedUri`.** This holds for a click and a middle click on it. When the gate refuses the link, the Open anchor has no `href`, and a click opens nothing. In 2.2, a preview opened without `isAllowedUri`, for example through `openPreviewHyperlink`, checked only `isSafeHref`. Check that your `isAllowedUri` allows every link your readers must open from the preview.

**The hand shows only while Mod is held.** `styles.css` sets no link cursor at rest. While Mod is held, the package sets `data-hyperlink-mod` on `<html>`, and `styles.css` shows the hand over links in editors with the `hyperlink-click-scope` class. The package adds that class to the editor element itself while `openOnClick` is `true`, the default. You add nothing. With `openOnClick: false`, the class and the hand are gone. If your own CSS sets a resting `cursor: pointer` on editor links, remove it. Otherwise the hand shows without Mod, but a click still opens the preview. A host that skips `styles.css` copies this rule to keep the hand:

```css
:root[data-hyperlink-mod] .hyperlink-click-scope a[href] {
  cursor: pointer;
}
```

### Rendering, parsing and roles

**The preview popover is `role="dialog"`, named "Link preview".** It was `role="toolbar"`. Update any test or style that selects it by role:

```ts
// 2.2
document.querySelector('[role="toolbar"]')
// 2.3
document.querySelector('[role="dialog"][aria-label="Link preview"]')
```

The role and the name sit on the popover frame, for any preview factory. The prebuilt preview content inside it keeps the `.hyperlink-preview-popover` class, as in 2.2. A custom factory's content has only your own classes. The hovercard is a separate popover, `.hyperlink-hovercard`, with no role, so this selector never matches it. The preview sets no `aria-modal`. The name "Link preview" is fixed English text, and no option changes it.

**A pasted `<a href>` becomes `hyperlink` even when StarterKit's Link is registered.** The `a[href]` parse rule now runs at priority 51, above Link's 50. A host that keeps Link to load stored `link` marks gets `hyperlink` from every new paste and HTML import. Code that reads new links as `link` must read `hyperlink`:

```ts
// 2.2, with Link registered first: a pasted link was often a `link` mark.
editor.getAttributes('link').href
// 2.3: a pasted or imported link is a `hyperlink` mark.
editor.getAttributes('hyperlink').href
```

Stored `link` marks still load as `link`, because Link stays registered.

**The `hyperlink` mark renders through a mark view.** With `linkIcon` unset, the `<a>` is the same as in 2.2. With `linkIcon` set, the `<a>` holds the icon first, then the link text in a `<span>`. `getHTML()`, Markdown and the clipboard never hold the icon. Two checks:

- `Hyperlink.extend({ addMarkView })` replaces the icon mark view, with no warning. To keep the icon, call `this.parent?.()` and wrap its result.
- A selector or test that expects text nodes directly inside an editor `<a>` must allow the `<span>`, when `linkIcon` is set.

**Parsed HTML drops every `.hyperlink-icon` element.** The package always registers a parse rule that ignores any element with the `hyperlink-icon` class, even with `linkIcon` unset. So a copied icon never becomes content. Content inside such an element is dropped too. This applies on `setContent`, on HTML paste and on HTML import. If your own HTML uses that class name, rename it before you load the HTML. To check stored HTML:

```sh
grep -rl 'hyperlink-icon' ./your-stored-html
```

## Migrating from 1.x

`2.0` redesigns the public surface. Option names, command names, CSS class names, the popover contract, and URL validation all changed.

**Options and commands.**

| `1.x`                                | `2.0`                           |
| ------------------------------------ | ------------------------------- |
| `autoHyperlink`                      | `autolink`                      |
| `hyperlinkOnPaste`                   | `linkOnPaste`                   |
| `editHyperLinkText`                  | `editHyperlinkText`             |
| `editHyperLinkHref`                  | `editHyperlinkHref`             |
| `tr.setMeta('preventAutoHyperlink')` | `tr.setMeta('preventAutolink')` |

The package augments the commands under the `hyperlink:` key, not `link:`. `setHyperlink()` with no arguments no longer opens UI — call `openCreateHyperlinkPopover()` instead.

**CSS class names.** camelCase became kebab-case, and the shell prefix changed from `.floating-toolbar` to `.floating-popover`.

| `1.x`                       | `2.0`                        |
| --------------------------- | ---------------------------- |
| `.floating-toolbar`         | `.floating-popover`          |
| `.floating-toolbar-arrow`   | `.floating-popover-arrow`    |
| `.floating-toolbar-content` | `.floating-popover-content`  |
| `.hyperlinkCreatePopover`   | `.hyperlink-create-popover`  |
| `.hyperlinkPreviewPopover`  | `.hyperlink-preview-popover` |
| `.hyperlinkEditPopover`     | `.hyperlink-edit-popover`    |
| `.buttonsWrapper`           | `.buttons-wrapper`           |
| `.inputsWrapper`            | `.inputs-wrapper`            |
| `.textWrapper`              | `.text-wrapper`              |
| `.hrefWrapper`              | `.href-wrapper`              |
| `.backButton`               | `.back-button`               |
| `.btn_applyModal`           | `.apply-button`              |

**Popover API.** The v1 split between "popover" and "floating-toolbar" is gone.

| `1.x`                                     | `2.0`                                                      |
| ----------------------------------------- | ---------------------------------------------------------- |
| `createFloatingToolbar(opts)`             | `createPopover(opts)`, same shape minus `surface`          |
| `hideCurrentToolbar()`                    | `getDefaultController().close()`                           |
| `updateCurrentToolbarPosition(ref?)`      | `getDefaultController().reposition(ref?)`                  |
| `FloatingToolbarOptions` / `…Instance`    | `PopoverOptions` / `Popover`                               |
| `HyperlinkUIController`                   | `PopoverController`                                        |
| `SurfaceKind`                             | `PopoverKind`                                              |
| `EditHyperlinkPopoverOptions` / `…Modal…` | `EditHyperlinkOptions`                                     |
| `state.surface`                           | `state.popoverKind`, plus `element` and `referenceElement` |

Slot factories return `HTMLElement | null` instead of `void`, and `PreviewHyperlinkOptions.attrs` is now required. The stylesheet no longer auto-injects — add `import '@docs.plus/extension-hyperlink/styles.css'` at app bootstrap when you use the prebuilt popovers.

**Behavior differences.** Audit any fixture or seeded content that relied on the old behavior.

- The package rejects `javascript:`, `data:`, `vbscript:`, `file:`, and `blob:` URLs at load, paste, input rule, click, and popover open, and drops stored ones.
- `validateURL` requires a plausible host for a web scheme, so `https://googlecom` no longer autolinks.
- `localhost:3000` and `mydomain.com:8080` now read as host:port, and canonicalize to `https://localhost:3000` and `https://mydomain.com:8080`.
- `SpecialUrlIcon` is gone, along with `SpecialUrlInfo.icon`. Map `SpecialUrlInfo.type` to your own renderer — see [Scheme classification](./url-handling.md#scheme-classification).
- Two `SpecialUrlInfo.type` values were renamed: `'tv'` → `'apple-tv'`, and `'appstore'` → `'app-store'`.

The full breaking-change list, with a one-shot rename script, is in the [CHANGELOG](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hyperlink/CHANGELOG.md#migrating-from-1x-to-20).
