# Guide

Part of the [`@docs.plus/extension-inline-code` README](../README.md).

## Styling

The package ships no CSS. `renderHTML` emits a bare `<code>` tag with your `HTMLAttributes` merged in. The span inherits whatever your stylesheet gives `<code>`.

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

The prefix lookbehind sits in both regexes, so the character before the opening backtick stays out of the match. Typing `` x`x` `` marks the content alone and keeps the leading `x` plain. The backtick rules build these patterns at runtime with `new RegExp`, so an engine with no lookbehind can still load the bundle. On Safari before 16.4 they fall back to an in-match prefix, and the character before the opening backtick is removed.

### Where the rules do not fire

- Inside a code block. The CodeBlock NodeSpec sets `code`, which suppresses every input rule.
- On triple backticks. `a ```x``` b` stays literal.
- On pasted `<pre><code>` markup. Neither rule sees it: `parseHTML` rejects a `<code>` whose parent is `PRE`, so the paste stays a code block.
- On a match that spans a non-text inline node — see [Caveats](./api.md#caveats).

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

Replacing `addInputRules` drops the inline-leaf guard the package wraps around its own rule. A match spanning a hard break then converts again. Copy the inline-leaf guard from [`src/inline-code.ts`](../src/inline-code.ts) to keep it.

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

The mark claims the `codespan` token through `markdownTokenName`, and `parseMarkdown` applies the name `inlineCode`. Without these hooks, a host that loads `@tiptap/markdown` exports the marked text with no backticks. The span then degrades to prose.

If StarterKit's `code` mark stays on, it claims the same `codespan` token. A Markdown import then applies `code`, not `inlineCode`, and priority does not decide this one. `StarterKit.configure({ code: false })` removes the contest.
