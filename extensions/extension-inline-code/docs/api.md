# API reference

Part of the [`@docs.plus/extension-inline-code` README](../README.md).

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

The backtick delimiter is not an option either — see [Input and paste rules](./guide.md#input-and-paste-rules).

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

Two paths return `false`, and they differ. Inside a code block the mark cannot apply, so `setInlineCode()` changes nothing and returns `false`. Over a span that already carries StarterKit's `code` mark, `setInlineCode()` and `toggleInlineCode()` return `false`. They still replace `code` with `inlineCode` — see [Caveats](#caveats). `Mod-e` over that span ends differently — see [Keyboard shortcuts](#keyboard-shortcuts).

On a collapsed caret, `setInlineCode()` seeds a stored mark, so the next character you type is code. `toggleInlineCode()` seeds the same stored mark when it turns the mark on. No placeholder character enters the document. `unsetInlineCode()` and toggling off clear that stored mark, so the next character is plain.

No command reads or writes Markdown. The mark carries its own Markdown hooks — see [Markdown](./guide.md#markdown).

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

## TypeScript

The package exports four named symbols and no default export.

- **Extension:** `InlineCode`
- **Type:** `InlineCodeOptions`
- **Regexes:** `inputRegex`, `pasteRegex`

The three commands are not exports. `setInlineCode`, `toggleInlineCode` and `unsetInlineCode` reach `editor.commands` through a module augmentation of `Commands<ReturnType>` in `@tiptap/core`. Importing `InlineCode` is enough to type them.
