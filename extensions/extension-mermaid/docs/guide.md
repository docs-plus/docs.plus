# Guide

Part of the [`@docs.plus/extension-mermaid` README](../README.md).

## Theming

Pele reads CSS variables named `--pele-*`. You can set them in CSS, or pass the `theme` option. The option sets each variable on the frame element with `style.setProperty`, so a strict CSP does not block it.

Set the variables on `.mermaid-diagram` itself, never on an ancestor. The shipped `styles.css` defines its defaults on `.mermaid-diagram`, and those defaults shadow any inherited value.

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

The frame has two package tokens: `--mermaid-diagram-border` and `--mermaid-diagram-radius`.

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

Each viewer can hide the source of a diagram. The choice is not stored in the document, so collaborators never see it.

- **Option.** `fold` takes `{ initial, remember }`, or `false` to remove the button. `initial` is `'open'`, `'folded'` or `'folded-when-read-only'`. The default is `'folded-when-read-only'`, so writers start open and read-only editors start folded.
- **When it is read.** The start state is read once, when the block's node view is built. If the editor turns read-only later, the block does not refold.
- **Memory.** With `remember: true`, the choice lives in that browser's `localStorage`. The key is `mermaid-diagram:fold:` plus a hash of the source text. When the source changes, the remembered choice no longer applies. If storage is blocked, the choice lasts for that block only.
- **The caret.** When the cursor enters a folded block, the block opens, so the caret never sits in hidden text. An arrow key that steps onto a folded block moves the caret into it, because the browser would skip the hidden text. This applies to editable editors. It does not write a remembered choice.
- **The summary.** A folded block shows a line such as "Mermaid source · 4 lines hidden". Clicking it opens the source. The click moves no caret.
- **Empty source.** A block with no source never folds.

The head row holds these controls:

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

With `@tiptap/extension-code-block-lowlight`, register a `mermaid` language that matches nothing. Otherwise `highlightAuto` guesses the language on every diagram change.

```ts
lowlight.register('mermaid', () => ({ name: 'Mermaid', contains: [] }))
```
