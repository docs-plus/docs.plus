# Styling

Part of the [`@docs.plus/extension-hyperlink` README](../README.md).

The prebuilt popovers ship a stylesheet — import it once when you use them:

```ts
import '@docs.plus/extension-hyperlink/styles.css'
```

The package's JavaScript never imports this file. Skip the import with a fully custom UI, and no CSS from this package reaches your bundle.

The stylesheet skins the popovers only. The mark renders a plain `<a>` with no class, so style your document links yourself:

```ts
Hyperlink.configure({ HTMLAttributes: { class: 'my-link' } })
```

```css
a.my-link {
  color: #2563eb;
  text-decoration: underline;
}
```

## Theming

Every visual token is a `--hl-*` custom property. Colors use [`light-dark()`](https://developer.mozilla.org/docs/Web/CSS/color_value/light-dark), so the popover follows the nearest ancestor's `color-scheme`, or the OS preference when none is set.

<details>
<summary>Default values</summary>

```css
:root {
  --hl-bg: light-dark(#ffffff, #1f2937);
  --hl-fg: light-dark(#111827, #f3f4f6);
  --hl-muted: light-dark(#6b7280, #9ca3af);
  --hl-border: light-dark(#e5e7eb, #374151);
  --hl-hover: light-dark(#f3f4f6, #374151);
  --hl-accent: light-dark(#2563eb, #60a5fa);
  --hl-accent-fg: light-dark(#ffffff, #0b1220);
  --hl-danger: light-dark(#dc2626, #f87171);
  --hl-shadow:
    0 20px 25px -5px light-dark(rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.5)),
    0 8px 10px -6px light-dark(rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.4));
  --hl-radius: 10px;
  --hl-radius-sm: 8px;
  --hl-font:
    ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --hl-font-size: 14px;
  --hl-transition: 120ms ease-out;
}
```

</details>

JavaScript positions the popover shell; the stylesheet does not. The shell gets `position: fixed` and an inline `z-index: 9999`. The three prebuilt popovers pin that value and expose no option for it. `createPopover({ zIndex })` sets the stacking of a popover you build yourself — see [Floating-popover primitive](./advanced.md#floating-popover-primitive).

If your app has a light/dark toggle, set `color-scheme` on the theme root and the popover follows along:

```css
html[data-theme='light'] {
  color-scheme: light;
}
html[data-theme='dark'] {
  color-scheme: dark;
}
```

> **Bundler note.** Some CSS minifiers (lightningcss, for one) down-level `light-dark()` into a `@media (prefers-color-scheme: dark)` block, which pins colors to the OS preference. Re-declare the tokens on each branch when that happens — the attribute selector wins over the media query:
>
> ```css
> html[data-theme='light'] {
>   --hl-bg: #ffffff;
>   --hl-fg: #111827; /* … */
> }
> html[data-theme='dark'] {
>   --hl-bg: #1f2937;
>   --hl-fg: #f3f4f6; /* … */
> }
> ```

## Class names

Stable class names you can target:

| Class                        | Element                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `.floating-popover`          | Popover container (adds `.visible` after mount).                             |
| `.floating-popover-arrow`    | Arrow pointing at the anchor (adds `-top` / `-bottom` / `-left` / `-right`). |
| `.floating-popover-content`  | Content wrapper inside the popover.                                          |
| `.floating-tooltip`          | Tooltip on popover icon buttons (adds `.visible`).                           |
| `.hyperlink-create-popover`  | Create-link form root.                                                       |
| `.hyperlink-preview-popover` | Preview toolbar root.                                                        |
| `.hyperlink-edit-popover`    | Edit-link form root.                                                         |
| `.inputs-wrapper`            | Input group container (adds `.error` on validation).                         |
| `.text-wrapper`              | Edit-form text input row (adds `.error`).                                    |
| `.href-wrapper`              | Edit-form URL input row (adds `.error`).                                     |
| `.buttons-wrapper`           | Button group container.                                                      |
| `.back-button`               | Edit-form back action.                                                       |
| `.apply-button`              | Edit-form apply action.                                                      |
| `.copy`                      | Preview-toolbar copy icon button.                                            |
| `.edit`                      | Preview-toolbar edit icon button.                                            |
| `.remove`                    | Preview-toolbar remove icon button.                                          |
| `.search-icon`               | Leading icon inside an input group.                                          |
| `.error-message`             | Validation error text (shown with `.show`).                                  |

The bundled `@docs.plus/floating-tooltip` ships the tooltips on the prebuilt popovers' icon buttons. It appends one bubble per bundle to the body, and shows it on hover and on keyboard focus. `styles.css` skins that bubble with a fixed literal block, and the block stays in lockstep with extension-hypermultimedia. See [Tooltip primitive](./advanced.md#tooltip-primitive) to attach the same labels to your own buttons.
