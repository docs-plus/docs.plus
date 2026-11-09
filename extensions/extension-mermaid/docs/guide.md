# Guide

Part of the [`@docs.plus/extension-mermaid` README](../README.md).

## Theming

Pele reads CSS variables named `--pele-*`. You can set them in CSS, or pass the `theme` option. The frame is the `.mermaid-diagram` element that wraps each diagram block. The option sets each variable on the frame with `style.setProperty`, so a strict CSP does not block it.

Set the variables on `.mermaid-diagram` itself, never on an ancestor. The shipped `styles.css` defines its defaults on `.mermaid-diagram`, and those defaults shadow any inherited value. Setting them inline on the frame at runtime is safe: the drawn diagram recolours in place and is not drawn again.

In print, `styles.css` hides the head and the zoom controls. A ready diagram prints as the picture. Any other state prints the source, even when it is folded.

```css
.mermaid-diagram {
  --pele-accent: #7c3aed;
  --mermaid-diagram-radius: 12px;
}
```

```ts
Mermaid.configure({ theme: { accent: '#7c3aed', radius: '6px' } })
```

The default colours use `light-dark()`. They follow the nearest `color-scheme` of your page. Without `color-scheme: light dark`, the light colours always show.

| `theme` field    | CSS variable                           |
| ---------------- | -------------------------------------- |
| `background`     | `--pele-bg`                            |
| `foreground`     | `--pele-fg`                            |
| `muted`          | `--pele-muted`                         |
| `line`           | `--pele-line`                          |
| `surface`        | `--pele-surface`                       |
| `surfaceAlt`     | `--pele-surface-alt`                   |
| `border`         | `--pele-border`                        |
| `accent`         | `--pele-accent`                        |
| `critical`       | `--pele-critical`                      |
| `fontFamily`     | `--pele-font`                          |
| `fontFamilyMono` | `--pele-font-mono`                     |
| `radius`         | `--pele-radius`                        |
| `series`         | `--pele-series-1` to `--pele-series-8` |

`series` sets chart and category colours. Pele repeats them after eight. A list longer than eight is cut to the first eight.

The frame has two package tokens: `--mermaid-diagram-border` and `--mermaid-diagram-radius`. They style the frame around the block. `--mermaid-diagram-radius` rounds the frame corners, and its default is `8px`. The `radius` field sets `--pele-radius`, which rounds shapes inside the drawn diagram.

### Without `styles.css`

The fold control, the head, the Syntax button, Copy and the summary row need the stylesheet. Without it they render unstyled, and the source never hides. If you skip it, set `fold: false`, `helpLink: false` and `copy: false`, then add these three rules. They must beat Pele's inline styles.

```css
.mermaid-diagram .pele-error {
  display: none;
}
.mermaid-diagram svg.pele {
  opacity: 1 !important;
}
.mermaid-diagram > [data-state='error'] svg.pele {
  opacity: 0.4 !important;
}
```

The first rule hides Pele's own error box, because the view shows the error. The second keeps the diagram at full opacity after a redraw. The third dims the last good diagram while an error stands.

## Fold and the Syntax button

Each viewer can hide the source of a diagram with the **Hide source** button. The `fold` option sets up that button. The choice is not stored in the document, so collaborators never see it.

- **Option.** `fold` takes `{ initial, remember }`, or `false` to remove the button. `initial` is `'open'`, `'folded'` or `'folded-when-read-only'`. The default is `'folded-when-read-only'`, so writers start open and read-only editors start folded.
- **When it is read.** The start state is read once, when the block's node view is built. If the editor turns read-only later, the block does not refold.
- **Memory.** With `remember: true`, the choice lives in that browser's `localStorage`. The key is `mermaid-diagram:fold:` plus a hash of the source text. When the source changes, the remembered choice no longer applies. If storage is blocked, the choice lasts for that block only.
- **The caret.** When the cursor enters a folded block, the block opens, so the caret never sits in hidden text. An arrow key that steps onto a folded block moves the caret into it, because the browser would skip the hidden text. This applies to editable editors. It does not write a remembered choice.
- **The summary.** A folded block shows a line such as "Mermaid source · 4 lines hidden". Clicking it opens the source. The click moves no caret.
- **Empty source.** A block with no source never folds.

The head row sits above the source. It holds these controls:

- At rest, only the `mermaid` label shows, in the right corner.
- On hover or keyboard focus, the label swaps in place for **Syntax**, **Copy** and **Hide source**.
- On touch screens, the buttons always show as 44 px icon buttons.

`helpLink` sets the guide the Syntax button opens in a new tab. It defaults to the Mermaid syntax reference, and `false` hides it. Syntax is a button, not a link, so a link extension in the same editor cannot take its click. `copy: false` hides the Copy button. Copy uses the Clipboard API, falls back to a hidden textarea, and shows a check for 2200 ms. With `fold`, `helpLink` and `copy` all off, the block has no head.

## The view slot

The `view` option replaces the built-in preview. It is a function that gets a context and returns a `MermaidView`.

```ts
interface MermaidViewContext {
  editor: Editor
  getPos: () => number | undefined
  retry: () => void // loads the renderer again after a load-error
}

interface MermaidView {
  dom: HTMLElement // placed under the source
  diagram: HTMLElement // the extension mounts Pele here
  update?: (snapshot: MermaidSnapshot) => void
  destroy?: () => void
}
```

The contract:

- Pele mounts into `diagram`. The extension clears only `diagram`, and never the rest of `dom`.
- A snapshot is the block's `state`, `error` and `diagramType`. The extension publishes a new snapshot when the state changes or a draw completes.
- `update` runs once when the view is built, with the first snapshot, and then on each publish. The `onStateChange` event extends that snapshot with `editor`, `getPos` and `durationMs`.
- The extension sets `data-state` on `dom`, sets `contenteditable="false"` on it, and gives `diagram` `overflow: hidden` and `contain: paint`.
- `destroy` runs when the block leaves the editor. Free your own resources there.
- `retry` loads the renderer again. Offer it on the `load-error` state.

A React sketch. It renders into a sibling `slot` and never into `diagram`, because Pele owns that element.

```tsx
import { createRoot } from 'react-dom/client'
import { Mermaid } from '@docs.plus/extension-mermaid'
import type { MermaidView, MermaidViewContext } from '@docs.plus/extension-mermaid'

function createReactView({ retry }: MermaidViewContext): MermaidView {
  const dom = document.createElement('div')
  const diagram = document.createElement('div') // Pele draws here
  const slot = document.createElement('div') // React renders here
  dom.append(diagram, slot)
  const root = createRoot(slot)
  return {
    dom,
    diagram,
    update: (snapshot) => root.render(<Status snapshot={snapshot} onRetry={retry} />),
    // Unmount after the current render, so React does not warn about a nested unmount.
    destroy: () => queueMicrotask(() => root.unmount())
  }
}

Mermaid.configure({ view: createReactView })
```

`Status` is your own component. Vue and Svelte follow the same shape.

## Accessible names

Pele gives the SVG `role="graphics-document document"` and an `aria-roledescription` that holds the diagram type. The source can name the diagram with Mermaid's own lines:

```
flowchart LR
  accTitle: Release steps
  accDescr: Write, review, then ship.
  A[Write] --> B[Review] --> C[Ship]
```

Pele writes `<title>` and `<desc>` elements and links them with `aria-labelledby` and `aria-describedby`. When the SVG has no `aria-labelledby`, the extension sets `aria-label` to the diagram type, for example `flowchart diagram`.

The built-in view uses no live region. Error text goes in through `textContent` only. The diagram host has `aria-busy="true"` while it loads. The view links the diagram to its error line with `aria-describedby`. The spinner is `aria-hidden`.

## Syntax highlighting

`@tiptap/extension-code-block-lowlight` has no node view of its own. So diagrams draw, and you write no node view code. The order of `CodeBlockLowlight` and `Mermaid` in the list does not matter. Install them yourself with `npm install @tiptap/extension-code-block-lowlight@^3.32.2 lowlight@^3 highlight.js@^11`. `createLowlight` and `common` exist only in lowlight 3. Turn off StarterKit's code block, because both define `codeBlock`. Then register a `mermaid` language that matches nothing. Otherwise `highlightAuto` guesses the language on every diagram change.

```ts
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import { Mermaid } from '@docs.plus/extension-mermaid'
import '@docs.plus/extension-mermaid/styles.css'

const lowlight = createLowlight(common)
lowlight.register('mermaid', () => ({ name: 'Mermaid', contains: [] }))

const editor = new Editor({
  extensions: [
    StarterKit.configure({ codeBlock: false }),
    CodeBlockLowlight.configure({ lowlight }),
    Mermaid
  ]
})
```

The empty language gives the diagram source no colours. If you extend `CodeBlockLowlight` with your own `addNodeView`, read [Keep your own code block view](#keep-your-own-code-block-view).

The lowlight plugin also highlights every code block again whenever the caret is in any code block, diagrams included. So in a document with many code blocks, each keystroke in a diagram redoes that work. A host can copy the plugin and skip `mermaid` blocks. The package does not export the plugin, so copy its source file. It is [`lowlight-plugin.ts`](https://github.com/ueberdosis/tiptap/blob/main/packages/extension-code-block-lowlight/src/lowlight-plugin.ts) in the Tiptap repository. Copy the file from the Tiptap version you install. Add this rule to your copy:

```ts
const isHighlighted = (name: string) => (node: ProseMirrorNode) =>
  node.type.name === name && node.attrs.language !== 'mermaid'
```

Use the rule in four places, where the upstream file tests `node.type.name === name`:

- the `findChildren` walk in `getDecorations`;
- the `oldNodes` list in `apply`;
- the `newNodes` list in `apply`;
- the caret check in `apply`. Replace `[oldNodeName, newNodeName].includes(name)` with `isHighlighted(name)(oldState.selection.$head.parent) || isHighlighted(name)(newState.selection.$head.parent)`.

Skip the caret check, and typing in a diagram still highlights every block again. With the copy in place, the empty `mermaid` language is no longer needed.

Then swap your copy in for the upstream plugin. Its key starts with `lowlight$`. `LowlightPlugin` is your copy, and it takes one object, as upstream does.

```ts
export const CodeBlock = CodeBlockLowlight.extend({
  addProseMirrorPlugins() {
    // ProseMirror keeps a plugin's key string on `plugin.key`, but its type hides the field.
    const base = (this.parent?.() ?? []).filter(
      (plugin) => !(plugin as unknown as { key: string }).key.startsWith('lowlight$')
    )
    return [
      ...base,
      LowlightPlugin({
        name: this.name,
        lowlight: this.options.lowlight,
        defaultLanguage: this.options.defaultLanguage
      })
    ]
  }
})
```

Use `CodeBlock` in place of `CodeBlockLowlight` in the extensions list. Compare your copy with the upstream file when you update Tiptap.

## Keep your own code block view

An `addNodeView` on `codeBlock` always wins over this extension's view, so no diagram draws. Call `mermaidNodeView` inside it. It draws `mermaid` blocks and returns `null` for every other block, so your view takes the rest.

```ts
import { mermaidNodeView } from '@docs.plus/extension-mermaid'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { CodeBlockComponent } from './CodeBlockComponent' // your own React component

const isMermaid = (node: ProseMirrorNode) => node.attrs.language === 'mermaid'

export const CodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    const mermaid = mermaidNodeView(this.editor)
    // Any node view renderer works here. React is only the example.
    const own = ReactNodeViewRenderer(CodeBlockComponent, {
      // Rebuild when a block enters or leaves mermaid, so the right view takes it.
      update: ({ oldNode, newNode, updateProps }) => {
        if (isMermaid(oldNode) !== isMermaid(newNode)) return false
        updateProps()
        return true
      }
    })
    return (props) => mermaid(props) ?? own(props)
  }
})
```

- Keep `Mermaid` in the same editor. `mermaidNodeView` throws without it.
- Your view must rebuild when a block's language changes to or from `mermaid`, as the `update` above does. Otherwise the block keeps the wrong view.
- A diagram block shows this extension's head, not your view. So a language picker in your view does not appear on diagram blocks.
- A plugin view is a `nodeViews.codeBlock` prop on a ProseMirror plugin. Among plugin views, the first one wins. A higher extension `priority` comes first. At equal priority, the extension listed last in `extensions` comes first. `Mermaid` has the default priority, 100. So with `extensions: [Mermaid, Other]` at equal priority, `Other` comes first. With `[Other, Mermaid]`, `Mermaid` comes first and hands the other blocks on.
- A plugin view that comes after this extension receives every block that is not `mermaid`. The same `update` rule applies to it.
- A plugin view that comes before this extension takes `mermaid` blocks too. No diagram draws, unless that view calls `mermaidNodeView`. In development, this case also shows the warning below.

### Use it in a plugin view

`mermaidNodeView` returns a Tiptap node view renderer. It takes one props object, as `addNodeView` passes. A ProseMirror plugin `nodeViews.codeBlock` prop passes positional arguments instead. So wrap the call there. In a Tiptap extension, the editor is `this.editor` inside `addProseMirrorPlugins`:

```ts
import { Extension } from '@tiptap/core'
import type { NodeViewRendererProps } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import type { NodeViewConstructor } from '@tiptap/pm/view'
import { mermaidNodeView } from '@docs.plus/extension-mermaid'

export const MyCodeBlockView = Extension.create({
  name: 'myCodeBlockView',
  addProseMirrorPlugins() {
    const mermaid = mermaidNodeView(this.editor)
    const codeBlock: NodeViewConstructor = (node, view, getPos) =>
      // yourView is your own NodeViewConstructor.
      mermaid({ node, view, getPos } as NodeViewRendererProps) ?? yourView(node, view, getPos)
    return [new Plugin({ props: { nodeViews: { codeBlock } } })]
  }
})
```

The renderer reads only `node` and `getPos` from the props, so the cast is safe today. It returns a ProseMirror `NodeView` for a `mermaid` block and `null` for any other block.

### The development warning

When another node view owns `codeBlock`, the console shows this warning. That view is an `addNodeView`, or a plugin view that comes before this extension.

```
[extension-mermaid] Another node view owns codeBlock, so diagrams do not draw. Use mermaidNodeView in that view: https://github.com/docs-plus/docs.plus/blob/main/extensions/extension-mermaid/docs/guide.md#keep-your-own-code-block-view
```

- It fires at most once per editor. A second editor on the same page can warn again. The check runs when the editor view is built and on each view update.
- It never fires once your view calls `mermaidNodeView`.
- It fires only when a global `process` exists and `process.env.NODE_ENV` is not `production`. This is the same check as Tiptap's own development warnings.
- Without a global `process`, the check stays off. The check changes only whether the warning shows, never which view draws. Many bundlers replace `process.env.NODE_ENV` but do not define `process` in the browser. Vite is one. There the warning never shows, and no option turns it on. To check by hand, load a `mermaid` block. If no `.mermaid-diagram` element appears, another view owns `codeBlock`.
