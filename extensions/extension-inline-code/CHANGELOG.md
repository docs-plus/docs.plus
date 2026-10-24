# Changelog

All notable changes to `@docs.plus/extension-inline-code` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/); the project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- The `@tiptap/core` and `@tiptap/pm` peer floor is now `^3.32.0`. It was `^3.31.3`.

## [2.2.0] — 2026-10-22

No behaviour change; aligned to the family.

### Documentation

- The README and the guide describe the Safari before 16.4 fallback correctly ([#485](https://github.com/docs-plus/docs.plus/issues/485)).
- The README links to the new Discord invite ([#480](https://github.com/docs-plus/docs.plus/issues/480)).

## [2.1.0] — 2026-10-13

### Highlights

- The package now loads on Safari and iOS Safari before 16.4, which have no RegExp lookbehind.
- The README is a short start page. An **Open in StackBlitz** button runs its Quickstart in the browser.
- The full reference moved to `docs/api.md`, `docs/guide.md` and `docs/migration.md` on GitHub.

### Changed

- Require `@tiptap/core` and `@tiptap/pm` `^3.31.3`. Version 2.0.0 required `^3.22.3`.

### Fixed

- The package loads on Safari and iOS Safari before 16.4. In 2.0.0, `inputRegex` and `pasteRegex` were lookbehind regex literals. Those engines cannot parse them, so the script that held the package failed to load. The package now builds both regexes at runtime.
- On those engines, `inputRegex` and `pasteRegex` fall back to the upstream `@tiptap/extension-code` pattern. There, a non-space character before the opening backtick is deleted. Engines with lookbehind keep that character plain, as before.

### Documentation

- The README is a short start page. It covers why to use the package, install, a Quickstart that shows a result, the caveats that fail with no error, and common tasks.
- The full reference moved to `docs/` on GitHub: `api.md`, `guide.md` and `migration.md`.
- The install line leads with `npm install`. `pnpm`, `yarn` and `bun` follow on the next line.
- The README names the hosts that can load the package, and says to load the editor in a web view on React Native.
- An **Open in StackBlitz** button runs the Quickstart in the browser. The app lives in `examples/vanilla`. The extension preflight fails when the app drifts from the README.
- A "For AI coding agents" row points agents at this README as plain Markdown on jsDelivr.
- The Quickstart mounts the editor, loads a sample line, and adds a CSS rule that stays readable in dark mode.
- The Caveats in the README and in `docs/api.md` list the `RangeError` that stored JSON with a `code` mark throws.
- The Discord badge uses a working invite link.

### Internal

- The npm keywords `tiptap extension` and `inline code` are now `tiptap-extension` and `inline-code`.

## [2.0.0] — 2026-08-11

### Highlights

- First npm release of this package; the 0.x line below was internal to the docs.plus monorepo and never published.

### Breaking

- Removed the `Mod-Shift-c` shortcut — it collided with Chromium DevTools' inspect-element. Use `Mod-e`.
- The mark now sets `excludes: '_'`: applying inline code removes other marks from the selection, matching `@tiptap/extension-code`.

### Migrating from `@tiptap/extension-code` and unpublished 0.x

The `0.x` line below was internal to the docs.plus monorepo and never shipped to npm. If you use Tiptap's built-in `Code` mark today:

1. `bun remove @tiptap/extension-code` (or drop it from StarterKit — see step 3).
2. `bun add @docs.plus/extension-inline-code`
3. `StarterKit.configure({ code: false })` — InlineCode owns the `<code>` tag and `Mod-e` at priority 101.
4. Replace `editor.commands.toggleCode()` with `toggleInlineCode()` (or keep `Mod-e` — same binding).
5. Drop `Mod-Shift-c` if you documented it; only `Mod-e` remains.

```ts
// @tiptap/extension-code
new Editor({ extensions: [StarterKit] })
editor.commands.toggleCode()

// @docs.plus/extension-inline-code
new Editor({ extensions: [StarterKit.configure({ code: false }), InlineCode] })
editor.commands.toggleInlineCode()
```

Visually identical `<code>` output; `isActive('code')` becomes `isActive('inlineCode')`.

`excludes: '_'` needs no action if you are coming from `@tiptap/extension-code` — that mark already sets it.

### Changed

- Entering inline code from a collapsed caret now uses a ProseMirror stored mark instead of inserting a zero-width space. No placeholder character enters the document.
- `ArrowRight` at the end of the document clears the stored code mark instead of inserting a space — a navigation key no longer mutates the document. The keypress still reaches the browser, so the caret keeps its native motion in right-to-left text, where `ArrowRight` moves backward. The custom `ArrowLeft` exit was removed.
- `setInlineCode` / `toggleInlineCode` / `unsetInlineCode` now delegate to Tiptap's standard `setMark` / `toggleMark` / `unsetMark`. Command names are unchanged.
- Raised the mark `priority` to 101. InlineCode now wins backtick input, paste, and `Mod-e` over StarterKit's `code` mark when a host leaves it enabled (instead of being shadowed by it).

### Fixed

- Toggling inline code off from a collapsed caret now clears code mode for the next character. It was a no-op — `removeMark` over an empty range did nothing, so the next typed character stayed code.
- Typing backtick code no longer throws `RangeError: Position out of range`. The input regex is end-anchored and non-global (``/(?<=^|[^`])`([^`]+)`(?!`)$/``); the global flag drifted the input-rule plugin's `lastIndex`. Paste keeps the global regex.
- Typing or pasting a code span directly after another character no longer deletes that character. It also no longer code-marks that character instead of the content when both were the same single character. The no-backtick-before guard is now a lookbehind, so the preceding character stays out of the match.
- Set `code: true` on the mark spec — other extensions' input rules (typography, bold) no longer rewrite code-span content.
- `ArrowRight` exit works when the last textblock is nested (blockquote/list) and clears a just-toggled pending stored mark.
- A code span no longer forms across a hard break. Tiptap builds the input-rule match text from the block's inline content, and `HardBreak.renderText()` contributes a newline, which ``[^`]+`` matches like any other character. So `` `foo `` + Shift-Enter + `` bar` `` marked one code span spanning the break. The rule now declines any match containing an inline node that is not text. That also covers inline leaves which define no `renderText`. Those fall back to the literal six-character `%leaf%` for a single document position. The resulting offset skew can push the replaced range outside the block. Inherited from upstream `@tiptap/extension-code`, which still has it.
- Code spans survive Markdown export and import. The mark carries upstream `@tiptap/extension-code`'s three markdown hooks (`markdownTokenName: 'codespan'`, `parseMarkdown`, `renderMarkdown`). Without them a host loading `@tiptap/markdown` exported `` `render()` `` as plain `render()`. The text survived, the code mark did not. Importing a file that already contained a code span produced no mark either.

### Documentation

- Corrected the package name in the README, removed the obsolete `ArrowLeft` shortcut, and documented the StarterKit `code` collision. Both claim `<code>` and `Mod-e`, so disable it with `StarterKit.configure({ code: false })`.
- The README now states the engine floor: Chrome 62+, Firefox 78+, Safari and iOS Safari 16.4+. The backtick rules are module-scope RegExp lookbehind literals, so an engine without lookbehind throws at parse time instead of degrading the mark.
- Corrected the Commands table note: on a collapsed caret, `unsetInlineCode()` and toggling off clear the stored mark instead of seeding one. Also narrowed the Caveats line that called `Mod-e` the only shortcut, which contradicted the `ArrowRight` row two sections above.

### Internal

- The published manifest no longer declares `engines` — the monorepo's Node floor gated engine-strict consumer installs even though the shipped bundle is plain browser-targeted ESM/CJS.
- Added a clean-room Cypress E2E suite (`@docs.plus/playground`, port 5176) against the built `dist/`: toggle, input rule, stored-mark caret entry, arrow exit, paste, and StarterKit-`code` coexistence (priority precedence).

## [0.1.1]

Baseline before this changelog. Inline code via backticks, the `Mod-Shift-c` / `Mod-e` shortcuts, and input/paste rules.
