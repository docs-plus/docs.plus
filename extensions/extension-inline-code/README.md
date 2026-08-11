# @docs.plus/extension-inline-code

<a href="https://docs.plus"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/apps/webapp/public/badges/badge-docsplus-dark.svg"><img alt="docs.plus" height="20" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/apps/webapp/public/badges/badge-docsplus.svg"></picture></a>
[![Version](https://img.shields.io/npm/v/@docs.plus/extension-inline-code.svg?label=version)](https://www.npmjs.com/package/@docs.plus/extension-inline-code)
[![Downloads](https://img.shields.io/npm/dm/@docs.plus/extension-inline-code.svg)](https://npmcharts.com/compare/@docs.plus/extension-inline-code)
[![License](https://img.shields.io/npm/l/@docs.plus/extension-inline-code.svg)](https://www.npmjs.com/package/@docs.plus/extension-inline-code)
[![Discord](https://img.shields.io/badge/discord-community-5865F2?logo=discord&logoColor=white)](https://discord.gg/25JPG38J59)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-inline-code/assets/preview-dark.png">
    <img alt="Inline code mark rendered as a monospace span inside a paragraph" width="640" src="https://raw.githubusercontent.com/docs-plus/docs.plus/main/extensions/extension-inline-code/assets/preview-light.png">
  </picture>
</p>

Tiptap mark for inline code (`` `code` ``).

Two traps come with a backtick code mark. `@tiptap/extension-code` exits a code span with `ArrowRight` and inserts a space. Here a collapsed caret enters through a ProseMirror stored mark, so no placeholder character enters the document. `ArrowRight` at the document end clears that stored mark and inserts nothing. The second trap is an in-match capture, which can eat or mismark the character before the opening backtick. A prefix lookbehind keeps that character out of the match instead. The input rule also declines a match that spans a non-text inline node. The mark replaces StarterKit's `code` mark, once the host sets `StarterKit.configure({ code: false })`. `<pre><code>` stays with CodeBlock, and Markdown export and import use the mark's own hooks.

## Install

```sh
bun add @docs.plus/extension-inline-code
```

Requires **`@tiptap/core` ^3.22.3** and **`@tiptap/pm` ^3.22.3** (Tiptap 3.x).

Installs with no runtime dependencies.

Also requires an engine with RegExp lookbehind — Chrome 62+, Firefox 78+, Safari and iOS Safari 16.4+ — because the backtick rules are module-scope regex literals.

Upgrading from `@tiptap/extension-code`? See [Migrating from `@tiptap/extension-code`](#migrating-from-tiptapextension-code).

## Quickstart

```ts
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { InlineCode } from '@docs.plus/extension-inline-code'

const editor = new Editor({
  extensions: [
    // StarterKit's `code` mark claims the same `<code>` tag and the same
    // `Mod-e` key. Turn it off, or the document carries two code marks.
    StarterKit.configure({ code: false }),
    InlineCode
  ]
})
```

The snippet passes no `element`, so mount the editor in your app before you type. Then type between single backticks (`` `like this` ``) to format text as inline code. Pasted backtick text converts the same way. The snippet adds no CSS, so the span inherits no styling of its own — see [Styling](#styling).

## Options

`.configure({ … })` takes one option.

| Option           | Type                  | Default | Description                                    |
| ---------------- | --------------------- | ------- | ---------------------------------------------- |
| `HTMLAttributes` | `Record<string, any>` | `{}`    | Attributes merged onto rendered `<code>` tags. |

```ts
InlineCode.configure({
  HTMLAttributes: { class: 'my-custom-class' }
})
```

`priority`, `excludes` and `code` are mark-spec fields, not options. Change them with `InlineCode.extend({ … })`, never with `.configure()`.

```ts
const InlineCodeFirst = InlineCode.extend({ priority: 120 })
```

The backtick delimiter is not an option either — see [Input and paste rules](#input-and-paste-rules).

## Commands

The extension registers three commands on `editor.commands`. There are no aliases.

| Command              | Description      |
| -------------------- | ---------------- |
| `setInlineCode()`    | Apply the mark.  |
| `toggleInlineCode()` | Toggle the mark. |
| `unsetInlineCode()`  | Remove the mark. |

```ts
editor.chain().focus().toggleInlineCode().run()
```

Read the active state with `editor.isActive('inlineCode')`, and gate a toolbar button with `editor.can().toggleInlineCode()` — see [Caveats](#caveats).

Each command wraps the matching Tiptap core command — `setMark`, `toggleMark` and `unsetMark` — and returns that command's boolean.

Two paths return `false`, and they differ. Inside a code block the mark cannot apply, so `setInlineCode()` changes nothing and returns `false`. Over a span that already carries StarterKit's `code` mark, `setInlineCode()` and `toggleInlineCode()` return `false` but still replace `code` with `inlineCode` — see [Caveats](#caveats). `Mod-e` over that span ends differently — see [Keyboard shortcuts](#keyboard-shortcuts).

On a collapsed caret, `setInlineCode()` seeds a stored mark, so the next character you type is code. `toggleInlineCode()` seeds the same stored mark when it turns the mark on. No placeholder character enters the document. `unsetInlineCode()` and toggling off clear that stored mark, so the next character is plain.

No command reads or writes Markdown. The mark carries its own Markdown hooks — see [Markdown](#markdown).

## Keyboard shortcuts

The extension binds two keys, both on the editor document.

| Shortcut     | Context    | Action                                                                   |
| ------------ | ---------- | ------------------------------------------------------------------------ |
| `Mod-e`      | `document` | Toggle inline code on the selection, or on the next typed character.     |
| `ArrowRight` | `document` | At the end of the document, clear the stored mark. Inserts no character. |

The mark registers at `priority: 101`, one step above the Tiptap default `100`. If StarterKit's `code` mark stays on, `Mod-e` is contested: that mark binds the same key at priority `100`.

Priority decides that key only on text that carries no `code` mark, where `InlineCode` wins. Over a span that already carries `code`, `toggleInlineCode()` returns `false` — see [Commands](#commands). The keymap then passes the key to StarterKit's `code` mark, and the span ends as `code`. Turning `code` off with `StarterKit.configure({ code: false })` removes the contest.

`ArrowRight` still reaches the browser, so the caret keeps its native motion. In right-to-left text `ArrowRight` moves the caret backward, and the key handler does not change that.

## Caveats

Most surprises come from StarterKit's `code` mark, which claims the same tag and the same key.

- **Two marks render `<code>`, and they exclude each other.** `priority: 101` wins typed backticks and pasted `<code>` markup, so typing `` `x` `` yields `inlineCode`. It does not win everywhere: `Mod-e` over an existing `code` span stays `code`, and a Markdown import applies `code`. Keep the schema to a single `<code>` mark with `StarterKit.configure({ code: false })`.
- **`editor.can().toggleInlineCode()` returns `false` over a `code` span.** A toolbar button gated on `can()` renders as disabled. Meanwhile `setInlineCode()` and `toggleInlineCode()` both replace `code` with `inlineCode` and still return `false`. The cause is `excludes: '_'`: the existing mark excludes every other mark, including this one. Turn StarterKit's `code` mark off, and `can()` reports `true` again.
- **`excludes: '_'` strips every other mark.** Applying inline code drops bold, italic and links from the selection, so code text never stacks other marks. Apply inline code first, then the surrounding formatting outside the span.
- **`code: true` suppresses other extensions' input rules inside a code span.** Typing `**x**` inside a span keeps the literal asterisks; typography and bold never rewrite code content. Type the formatting outside the span.
- **The inline-leaf guard declines a match that spans a non-text inline node.** A backtick pair around a hard break or a mention never converts. Both render text that ``[^`]+`` matches, so the span would form across the node. An inline leaf that defines no `renderText` never converts either. `@tiptap/core` substitutes the six-character `%leaf%` for one position, so the replaced range skews. Select the text and run `toggleInlineCode()` instead.
- **`ArrowRight` clears the stored mark only at the document end.** At the end of a paragraph in the middle of a document the key does nothing, so the next character stays code. Press `Mod-e`, or run `toggleInlineCode()`.

## Styling

The package ships no CSS. `renderHTML` emits a bare `<code>` tag with your `HTMLAttributes` merged in, so the span inherits whatever your stylesheet gives `<code>`.

CodeBlock renders `<pre><code>`, so a bare `code` selector matches both elements. Exclude the code block:

```css
.ProseMirror :not(pre) > code {
  background: #f3f4f6;
  border-radius: 4px;
  padding: 0.15em 0.3em;
  font-size: 0.9em;
}
```

To target the mark by class instead, set one through `HTMLAttributes` and drop the `:not(pre)` selector:

```ts
InlineCode.configure({ HTMLAttributes: { class: 'inline-code' } })
```

```css
.inline-code {
  background: #f3f4f6;
  border-radius: 4px;
  padding: 0.15em 0.3em;
}
```

## Input and paste rules

Two rules convert backtick text: one input rule while you type, one paste rule over pasted text. Both regexes are named exports.

```ts
export const inputRegex = /(?<=^|[^`])`([^`]+)`(?!`)$/
export const pasteRegex = /(?<=^|[^`])`([^`]+)`(?!`)/g
```

`inputRegex` is end-anchored and non-global, because a global flag moves the input-rule plugin's `lastIndex`. `pasteRegex` keeps the global flag, so one paste converts every span it finds.

The prefix lookbehind sits in both regexes, so the character before the opening backtick stays out of the match. Typing `` x`x` `` marks the content alone and keeps the leading `x` plain.

### Where the rules do not fire

- Inside a code block. The CodeBlock NodeSpec sets `code`, which suppresses every input rule.
- On triple backticks. `a ```x``` b` stays literal.
- On pasted `<pre><code>` markup. Neither rule sees it: `parseHTML` rejects a `<code>` whose parent is `PRE`, so the paste stays a code block.
- On a match that spans a non-text inline node — see [Caveats](#caveats).

### Undo the conversion

Press `Backspace` right after the rule converts the text, to keep a backtick pair plain. Tiptap's `undoInputRule` reverts the transform alone, so `` `x` `` comes back as literal backticks.

### Bring your own delimiter

The delimiter lives in the two regexes, not in an option. To use another one, extend the mark and replace both rules:

```ts
import { markInputRule, markPasteRule } from '@tiptap/core'
import { InlineCode } from '@docs.plus/extension-inline-code'

const TildeCode = InlineCode.extend({
  addInputRules() {
    return [markInputRule({ find: /(?<=^|[^~])~([^~]+)~(?!~)$/, type: this.type })]
  },
  addPasteRules() {
    return [markPasteRule({ find: /(?<=^|[^~])~([^~]+)~(?!~)/g, type: this.type })]
  }
})
```

Replacing `addInputRules` drops the inline-leaf guard the package wraps around its own rule, so a match spanning a hard break converts again. Copy the inline-leaf guard from [`src/inline-code.ts`](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-inline-code/src/inline-code.ts) to keep it.

## Markdown

A code span survives Markdown export and import, once the host loads `@tiptap/markdown`. The package does not load `@tiptap/markdown` itself.

```ts
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { InlineCode } from '@docs.plus/extension-inline-code'
import { Markdown } from '@tiptap/markdown'

const editor = new Editor({
  extensions: [StarterKit.configure({ code: false }), InlineCode, Markdown]
})

editor.commands.setContent('Call `render()` first.', { contentType: 'markdown' })
editor.getMarkdown() // 'Call `render()` first.'
```

The mark claims the `codespan` token through `markdownTokenName`, and `parseMarkdown` applies the name `inlineCode`. Without these hooks a host loading `@tiptap/markdown` exports the marked text with no backticks, and the span degrades to prose.

If StarterKit's `code` mark stays on, it claims the same `codespan` token. A Markdown import then applies `code`, not `inlineCode`, and priority does not decide this one. `StarterKit.configure({ code: false })` removes the contest.

## Migrating from `@tiptap/extension-code`

Five steps, and one of them touches stored content.

1. Turn StarterKit's `code` mark off: `StarterKit.configure({ code: false })`. Run `bun remove @tiptap/extension-code` if the host installed it on its own.
2. Rename the commands: `setCode` → `setInlineCode`, `toggleCode` → `toggleInlineCode`, `unsetCode` → `unsetInlineCode`.
3. Rename the state reads: `isActive('code')` → `isActive('inlineCode')`. The rendered HTML is the same `<code>` tag either way.
4. Change the import. `@tiptap/extension-code` ships `Code` as a default export; this package exports named symbols only. Write `import { InlineCode } from '@docs.plus/extension-inline-code'`.
5. Rename the mark in stored ProseMirror JSON: `"type": "code"` becomes `"type": "inlineCode"`.

Step 5 is not optional. Once `code` is off, loading JSON that still carries a `code` mark throws `RangeError: There is no mark type code in this schema`, Tiptap logs `Invalid content`, and the editor keeps an empty paragraph. Stored HTML needs no migration: `<p><code>render()</code></p>` parses straight to `inlineCode`.

Run this over every stored document once, before the host loads it:

```ts
type StoredNode = { marks?: { type: string }[]; content?: StoredNode[] }

function renameCodeMark<T extends StoredNode>(node: T): T {
  const next = { ...node }
  if (next.marks) {
    next.marks = next.marks.map((m) => (m.type === 'code' ? { ...m, type: 'inlineCode' } : m))
  }
  if (next.content) next.content = next.content.map(renameCodeMark)
  return next
}
```

Behavior differences:

| Behavior                               | `@tiptap/extension-code`                     | `@docs.plus/extension-inline-code`                  |
| -------------------------------------- | -------------------------------------------- | --------------------------------------------------- |
| `priority`                             | declares none, so it sorts at `100`          | `101`                                               |
| `parseHTML`                            | every `<code>` tag                           | a `<code>` tag whose parent is not `PRE`            |
| `ArrowRight` at the end of a textblock | `exitable: true` — exits and inserts a space | exits only at the document end, and inserts nothing |
| Input-rule prefix                      | an in-match capture                          | a lookbehind                                        |
| Input rule over a non-text inline node | no inline-leaf guard, so the match converts  | declines the match                                  |
| Exports                                | named symbols plus `Code` as default         | named symbols only                                  |

docs.plus kept the `0.x` line inside the monorepo and never published it. If you used it there, drop `Mod-Shift-c`: `Mod-e` is the only toggle key.

Full breaking-change list: [CHANGELOG](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-inline-code/CHANGELOG.md).

## TypeScript

The package exports four named symbols and no default export.

- **Extension:** `InlineCode`
- **Type:** `InlineCodeOptions`
- **Regexes:** `inputRegex`, `pasteRegex`

The three commands are not exports. `setInlineCode`, `toggleInlineCode` and `unsetInlineCode` reach `editor.commands` through a module augmentation of `Commands<ReturnType>` in `@tiptap/core`. Importing `InlineCode` is enough to type them.

## Part of docs.plus

This extension is built for and maintained by [docs.plus](https://docs.plus). docs.plus is a free, real-time collaboration tool that lets communities organize knowledge hierarchically, with a chat thread on every heading. docs.plus runs these packages from source in production, so every release is exercised there before it reaches npm.

- Website: [docs.plus](https://docs.plus)
- Project README: [docs-plus/docs.plus](https://github.com/docs-plus/docs.plus#readme)
- Sibling extensions and recommended pairings: [extensions/README.md](https://github.com/docs-plus/docs.plus/blob/main/extensions/README.md)

## Contributing

Bug reports and PRs welcome. Setup, test commands, and the playground harness live in [CONTRIBUTING.md](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-inline-code/CONTRIBUTING.md).

## License

MIT — see [LICENSE](https://github.com/docs-plus/docs.plus/blob/main/LICENSE).
