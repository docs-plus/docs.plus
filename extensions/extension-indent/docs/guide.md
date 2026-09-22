# Guide

Part of the [`@docs.plus/extension-indent` README](../README.md).

## Styling

The package ships no CSS. The default editor needs none either. `@tiptap/core` injects `.ProseMirror { white-space: pre-wrap; white-space: break-spaces; }` while `injectCSS` stays `true`, so the editor keeps every space the command inserts.

Two cases need a host rule:

- The host passes `injectCSS: false` to the `Editor` constructor.
- A host stylesheet overrides `white-space` on `.ProseMirror`. Tiptap appends its `<style>` tag to `<head>`, so a host rule wins through a later stylesheet or a stronger selector.

Add this rule in either case:

```css
.ProseMirror {
  white-space: pre-wrap;
}
```

`white-space: break-spaces` keeps the run as well.

When the indent still collapses, read the computed `white-space` on the editor element. ProseMirror logs a console warning when that value is `normal`, `nowrap` or `pre-line`.

## Multiline selections

Every non-empty textblock the selection covers counts as one line. An empty textblock is not a line. The command skips a textblock the selection only touches at a boundary. The selection touches a boundary when the caret lands on the textblock's first position.

Lines indent and outdent at their starts, even when the selection begins or ends mid-line. The same rule covers a select-all.

`indent()` and `outdent()` apply the context gate the same way. Every covered line must match `allowedIndentContexts`, or the command returns `false` and leaves the document unchanged.

They differ after that gate. `indent()` prefixes every line. `outdent()` removes `indentChars` only from the lines whose text starts with it, and leaves the rest alone. `outdent()` returns `false` only when no covered line carries an indent.

```ts
// Before, with the two-space default:
//   '  AA'
//   'BB'
editor.chain().focus().outdent().run()
// After: 'AA' and 'BB'. The second line was already flush, so it did not move.
```

A table `CellSelection` works too. It exposes only its head cell on `from` and `to`, so both commands walk `selection.ranges` instead. `indent()` over a selected cell rectangle indents every cell in it, under the same allowlist.

## Outdent at the caret

With an empty selection, `outdent()` removes one of two things:

- one `indentChars` immediately before the caret. This undoes a fresh Tab without moving the caret to column 0.
- the line's leading `indentChars`, when the caret sits at the start of an indented line.

The two cases never overlap, because the caret is either at the line start or after some text. When neither applies, the command returns `false` and changes nothing.

`outdent()` checks the document text before it deletes. So it never removes a zero-width inline node, such as a hard break, in place of indent characters.

## Persistence

Literal indent is characters in the text, not a node attribute, so it survives wherever the text survives.

`editor.getJSON()` round-trips it with no extra option. A paragraph holding `'  Hi'` serializes to `{"type":"text","text":"  Hi"}` and reloads as `'  Hi'`.

`editor.getHTML()` does not. HTML parsing collapses a whitespace run and strips the leading one. So `setContent(savedHtml)` returns the paragraph unindented. Pass `parseOptions` to keep it:

```ts
editor.commands.setContent(savedHtml, { parseOptions: { preserveWhitespace: true } })
```

The constructor loads content the same way, and `parseOptions` is a top-level field there:

```ts
const editor = new Editor({
  extensions: [StarterKit, Indent],
  content: savedHtml,
  parseOptions: { preserveWhitespace: true }
})
```

Both `true` and `'full'` keep the whitespace run. `'full'` also keeps newlines, which literal indent does not need.
