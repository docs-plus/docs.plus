# Guide

Part of the [`@docs.plus/extension-placeholder` README](../README.md).

## How it works

A textblock is a node that holds inline text, such as a paragraph or a heading. Tiptap's built-in Placeholder scans every top-level block with `doc.descendants` on every editor update, and the whole tree when `includeChildren` is on. This package starts at the cursor and walks up, so the cost tracks the cursor depth, not the document length. It writes the hint text into a `data-placeholder` attribute on the empty textblock at the cursor. It also adds `emptyNodeClass` to every empty ancestor wrapper above that textblock. It accepts four of the built-in's seven options, and its callback form gains `parentName` and `doc`.

## Styling

The package ships no CSS.

The extension writes the resolved hint text into the `data-placeholder` attribute of the empty textblock at the cursor. Add this rule to render it:

```css
.ProseMirror [data-placeholder]::before {
  content: attr(data-placeholder);
  color: #9ca3af;
  float: left;
  height: 0;
  pointer-events: none;
}
```

### Class names

| Name                                   | Where the extension adds it                                    | When                                                                                                                                        |
| -------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-placeholder` (attribute)         | the empty textblock at the cursor only                         | the cursor sits in an empty textblock, the resolved hint text is not empty, and the editor is editable or `showOnlyWhenEditable` is `false` |
| `is-empty` (`emptyNodeClass`)          | that same textblock, and every empty ancestor wrapper above it | the same three conditions as `data-placeholder`                                                                                             |
| `is-editor-empty` (`emptyEditorClass`) | the same nodes as `is-empty`, next to it                       | the same three conditions, and the whole document is empty                                                                                  |

Target `[data-placeholder]`, not `.is-empty`. The extension adds the empty class to an empty list item or blockquote, but not the attribute. A `.is-empty::before { content: attr(data-placeholder) }` rule therefore paints an empty pseudo-element on those wrappers as well.

The extension never adds `is-editor-empty` to the editor root, because the ancestor walk stops below the document node. A `.ProseMirror.is-editor-empty` selector matches nothing.

To show the hint only while the document is fully empty, swap the selector of the rule above for the selector below:

```css
.ProseMirror .is-editor-empty[data-placeholder]::before {
  content: attr(data-placeholder);
  color: #9ca3af;
  float: left;
  height: 0;
  pointer-events: none;
}
```

Select the empty ancestor wrappers on their own. This rule dims an empty blockquote or list item. Replace the declaration as needed:

```css
.ProseMirror blockquote.is-empty,
.ProseMirror li.is-empty {
  opacity: 0.6;
}
```

The extension has no focus option. To hide the hint while the editor has no focus, add this rule:

```css
.ProseMirror:not(:focus-within) [data-placeholder]::before {
  content: none;
}
```

## Collaborative editing

A remote edit that leaves the local selection alone keeps the hint, and moves it with the document.

The plugin rebuilds its decorations when a transaction changes the document or sets the selection. A Yjs update arrives as a document change, so the rebuild runs and the decoration follows the new position. A transaction that carries only metadata, such as an awareness ping, skips the rebuild and keeps the previous decoration set.

The decoration is local to one editor view. It never enters the document, so it never syncs to another client, and each client sees the hint at its own cursor.

The clean-room spec [cypress/e2e/external-edit.cy.ts](https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-placeholder/cypress/e2e/external-edit.cy.ts) covers both shapes: text inserted elsewhere, and a paragraph inserted before the empty textblock.
