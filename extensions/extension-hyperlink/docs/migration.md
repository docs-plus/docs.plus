# Migrating from 1.x

Part of the [`@docs.plus/extension-hyperlink` README](../README.md).

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

- The package rejects `javascript:`, `data:`, and `vbscript:` URLs at load, paste, input rule, click, and popover open, and drops stored ones.
- `validateURL` requires a plausible host for a web scheme, so `https://googlecom` no longer autolinks.
- `localhost:3000` and `mydomain.com:8080` now read as host:port, and canonicalize to `https://localhost:3000` and `https://mydomain.com:8080`.
- `SpecialUrlIcon` is gone, along with `SpecialUrlInfo.icon`. Map `SpecialUrlInfo.type` to your own renderer — see [Scheme classification](./url-handling.md#scheme-classification).
- Two `SpecialUrlInfo.type` values were renamed: `'tv'` → `'apple-tv'`, and `'appstore'` → `'app-store'`.

The full breaking-change list, with a one-shot rename script, is in the [CHANGELOG](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-hyperlink/CHANGELOG.md#migrating-from-1x-to-20).
