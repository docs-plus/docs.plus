# Styling

Part of the [`@docs.plus/extension-hypermultimedia` README](../README.md).

The package ships one stylesheet. It carries the resize gripper, the loading shell, the media toolbar, the caption, and the `x`, `loom` and `spotify` embed styles.

```ts
import '@docs.plus/extension-hypermultimedia/styles.css'
```

## Theming

Every visual token is a `--hm-*` CSS custom property, declared with `light-dark()`. The toolbar, loading shell, gripper and caption follow the nearest ancestor's `color-scheme`. Set `color-scheme: light | dark` on `<html>` or any ancestor and they flip with it. Under the default `color-scheme: normal` they follow the OS `prefers-color-scheme`.

The X embed plate keys on the node's own `theme` attribute instead, so the plate matches what the embedded widget renders.

| Token                         | Description                                                   |
| ----------------------------- | ------------------------------------------------------------- |
| `--hm-toolbar-bg`             | Toolbar and menu background                                   |
| `--hm-toolbar-fg`             | Toolbar icon and menu text color                              |
| `--hm-toolbar-border`         | Toolbar and menu borders                                      |
| `--hm-toolbar-hover`          | Toolbar button / menu row hover background                    |
| `--hm-toolbar-active`         | Active (toggled) action background                            |
| `--hm-toolbar-active-fg`      | Active action icon/text color, and the menu row focus outline |
| `--hm-toolbar-danger`         | Text of the overflow menu row whose action `id` is `delete`   |
| `--hm-toolbar-shadow`         | Toolbar and menu drop shadow                                  |
| `--hm-caption-fg`             | Caption text                                                  |
| `--hm-caption-placeholder`    | Empty-caption placeholder text                                |
| `--hm-loading-bg`             | Loading shell background                                      |
| `--hm-loading-shimmer`        | Loading shimmer sweep                                         |
| `--hm-loading-provider`       | Provider label ("YouTube", …)                                 |
| `--hm-loading-message`        | Loading status message                                        |
| `--hm-loading-error`          | Error-state message color                                     |
| `--hm-loading-spinner-track`  | Spinner track ring                                            |
| `--hm-loading-spinner-active` | Spinner active arc                                            |
| `--hm-resize-border`          | Gripper and selected-media border                             |
| `--hm-resize-handle-bg`       | Gripper handle fill                                           |

Override any token to retheme:

```css
:root {
  --hm-toolbar-active: #ecfdf5;
  --hm-resize-border: #059669;
}
```

The shimmer and spinner animations are disabled under `prefers-reduced-motion: reduce`.

## Class names

These names are the stable styling contract. A custom toolbar, a custom action and a custom loading overlay all hook into the same class names.

| Class or attribute                                                      | Element                                                                              |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `.media-toolbar`                                                        | Toolbar root, in the built-in top-right skin.                                        |
| `[data-hm-toolbar]`                                                     | Lifecycle marker. The kit stamps this on every mounted toolbar, built-in or custom.  |
| `.hm-has-toolbar`                                                       | On the media wrapper while a toolbar is mounted.                                     |
| `.media-toolbar__button`                                                | Inline action button. Adds `--active` when toggled.                                  |
| `.media-toolbar__button--text`                                          | Inline button with a text label, used when no icon resolves for the id.              |
| `.media-toolbar__more`                                                  | The `…` overflow trigger.                                                            |
| `.media-toolbar__divider`                                               | Separator grouping inline actions.                                                   |
| `.media-toolbar__menu`                                                  | Overflow menu body, `role="menu"`. Rows are `__menu-item`, plus `--active`.          |
| `.media-toolbar__menu-divider`                                          | Overflow menu separator, before the `delete` row and after a `dividerAfter` action.  |
| `.media-toolbar__menu-section` / `.media-toolbar__menu-heading`         | Expanded submenu group inside the overflow menu, and its sentence-case title.        |
| `.media-toolbar__submenu`                                               | Submenu body. Rows are `__submenu-item`, plus `--active`.                            |
| `.media-toolbar__submenu-section` / `.media-toolbar__submenu-heading`   | Grouped rows inside a submenu, and the sentence-case group title (X Size and Theme). |
| `.media-toolbar__input`                                                 | URL field in the Replace URL form.                                                   |
| `.media-toolbar__error`                                                 | Validation message under the URL field.                                              |
| `.floating-tooltip`                                                     | Shared hover and focus tooltip bubble on icon buttons.                               |
| `.floating-popover`                                                     | Positioning container for every menu and form the toolbar opens.                     |
| `.hm-caption`                                                           | Editable `<figcaption>`. Adds `--empty` when the text is blank.                      |
| `.hypermultimedia--figure`                                              | The node emits this `<figure>` wrapper for a captioned image.                        |
| `.hypermultimedia--<type>__content`                                     | Media wrapper per node, for example `.hypermultimedia--youtube__content`.            |
| `.hypermultimedia__resize-gripper`                                      | Gripper widget. Adds `--active` on hover and `--dragging` during a drag.             |
| `.ProseMirror-selectednode`                                             | Selected media wrapper. Its `.hm-media-host` gets a 1px `--hm-resize-border` frame.  |
| `.hypermultimedia--resize-dragging`                                     | On `<html>` for the duration of a drag.                                              |
| `.hm-media-host` / `[data-hm-loading]`                                  | Loading shell host, and its `pending` / `ready` / `error` state.                     |
| `.hm-media-host--plain` / `.hm-media-host--fluid`                       | Host with the shell disabled, and host after an X embed settles.                     |
| `.hm-media-slot`                                                        | Holds the real media. Stays at `opacity: 0` until the shell settles.                 |
| `.hm-loading-shell` / `.hm-loading-shell__overlay`                      | Overlay root. The kit stamps this on the built-in overlay and on a custom one.       |
| `.hm-loading-shell__body`                                               | Row holding the provider label, message and spinner.                                 |
| `.hm-loading-shell__provider` / `__message` / `__shimmer` / `__spinner` | Provider label, status text, shimmer sweep, spinner.                                 |
