# Security

Part of the [`@docs.plus/extension-hyperlink` README](../README.md).

`isSafeHref` blocks the dangerous schemes (`javascript:`, `data:`, `vbscript:`, `file:`, `blob:`) at every boundary below. The gate tests a control-stripped copy of the href. An embedded tab, newline, or control character therefore cannot hide a scheme from the gate. The gate catches `java\tscript:` even though browsers resolve it as `javascript:`.

- **Parse** — `parseHTML` drops the mark on any `<a href>` whose scheme is blocked, on document load and on paste. The text survives; only the link goes.
- **Import** — `parseMarkdown` normalizes the href and stores an empty string when the scheme is blocked. Both import paths apply the `isSafeHref` floor alone, so a tightened `isAllowedUri` never strips marks from existing documents.
- **Write** — the input rule, paste rule, paste handler, autolink, `setHyperlink`, `toggleHyperlink`, and `editHyperlink` all route through the [composed gate](./api.md#validate-vs-isalloweduri).
- **Serialize** — `renderHTML` re-checks `isSafeHref` and emits an empty `href` when a hostile mark reaches it. A hostile mark can arrive through a legacy migration, a raw `addMark`, or Yjs replay. `renderMarkdown` blanks the same way.
- **Navigate** — primary click, middle-click (`auxclick`), touch, and the preview popover's href link all gate `window.open(…)` on the composed gate. They also pass `'noopener,noreferrer'`, so an opened tab cannot read `window.opener` or leak the Referer.

On the read side, the click handlers prefer the stored mark attribute over the DOM `link.href` property. A relative href injected through `setContent` therefore does not resolve against the host page's origin.

`isSafeHref(href)` and `DANGEROUS_SCHEME_RE` are exported for a custom popover that needs the same check. Prefer `isSafeHref`, because it returns a TypeScript type guard.

`SAFE_WINDOW_FEATURES` is the `'noopener,noreferrer'` string the package passes as the third argument of every `window.open` call. Pin the same constant in your own popovers and click handlers, so a future tightening propagates from one place.
