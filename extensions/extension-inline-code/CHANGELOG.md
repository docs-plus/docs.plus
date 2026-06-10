# Changelog

All notable changes to `@docs.plus/extension-inline-code` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/); the project adheres to [Semantic Versioning](https://semver.org/).

## [2.0.0] — 2026-06-10

### Highlights

- First npm release of this package; the 0.x line below was internal to the docs.plus monorepo and never published.

### Breaking

- Removed the `Mod-Shift-c` shortcut — it collided with Chromium DevTools' inspect-element. Use `Mod-e`.
- The mark now sets `excludes: '_'`: applying inline code removes other marks from the selection, matching `@tiptap/extension-code`.

### Changed

- Entering inline code from a collapsed caret now uses a ProseMirror stored mark instead of inserting a zero-width space. No placeholder character enters the document.
- `ArrowRight` at the end of the document clears the stored code mark instead of inserting a space — a navigation key no longer mutates the document. The custom `ArrowLeft` exit was removed.
- `setInlineCode` / `toggleInlineCode` / `unsetInlineCode` now delegate to Tiptap's standard `setMark` / `toggleMark` / `unsetMark`. Command names are unchanged.
- Raised the mark `priority` to 101 so InlineCode wins backtick input, paste, and `Mod-e` over StarterKit's `code` mark when a host leaves it enabled (instead of being shadowed by it).

### Fixed

- Toggling inline code off from a collapsed caret now clears code mode for the next character. It was a no-op — `removeMark` over an empty range did nothing, so the next typed character stayed code.
- Typing backtick code no longer throws `RangeError: Position out of range`. The input regex is end-anchored and non-global (``/(^|[^`])`([^`]+)`(?!`)$/``); the global flag drifted the input-rule plugin's `lastIndex`. Paste keeps the global regex.
- Set `code: true` on the mark spec — other extensions' input rules (typography, bold) no longer rewrite code-span content.
- `ArrowRight` exit works when the last textblock is nested (blockquote/list) and clears a just-toggled pending stored mark.

### Documentation

- Corrected the package name in the README, removed the obsolete `ArrowLeft` shortcut, and documented the StarterKit `code` collision: both claim `<code>` and `Mod-e`, so disable it with `StarterKit.configure({ code: false })`.

### Internal

- Added a clean-room Cypress E2E suite (`@docs.plus/playground`, port 5176) against the built `dist/`: toggle, input rule, stored-mark caret entry, arrow exit, paste, and StarterKit-`code` coexistence (priority precedence).

## [0.1.1]

Baseline before this changelog. Inline code via backticks, the `Mod-Shift-c` / `Mod-e` shortcuts, and input/paste rules.
