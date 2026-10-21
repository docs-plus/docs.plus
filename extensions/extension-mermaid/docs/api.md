# API reference

Part of the [`@docs.plus/extension-mermaid` README](../README.md).

## Options

`.configure({ … })` takes eleven options. `configure()` deep-merges plain objects, so `limits: { edges: 200 }` keeps the default `characters`.

| Option           | Type                                                     | Default                                                | Description                                                                                            |
| ---------------- | -------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `theme`          | `MermaidTheme \| null`                                   | `null`                                                 | Pele colour and font variables, set on each frame. Values are CSS, so `var()` and `light-dark()` work. |
| `view`           | `((context: MermaidViewContext) => MermaidView) \| null` | `null` (built-in view)                                 | Replaces the built-in preview. Return the element Pele draws into.                                     |
| `sanitize`       | `((svg: string) => Node) \| null`                        | `null`                                                 | Host sanitizer for each SVG string before it enters the page.                                          |
| `images`         | `boolean`                                                | `false`                                                | Remote images make every viewer of a shared document fetch the URL.                                    |
| `zoom`           | `'auto' \| false`                                        | `'auto'`                                               | Pele zoom controls on fine pointers. Always off on coarse pointers.                                    |
| `limits`         | `MermaidLimits`                                          | `{ characters: 10000, edges: 250 }`                    | Sources over these limits show a `limit` error and are never drawn.                                    |
| `fold`           | `MermaidFold \| false`                                   | `{ initial: 'folded-when-read-only', remember: true }` | Lets each viewer hide the source. Nothing is stored in the document. `false` removes the button.       |
| `helpLink`       | `string \| false`                                        | `'https://mermaid.js.org/intro/syntax-reference.html'` | The "Syntax" button on hover opens this guide in a new tab. `false` hides it.                          |
| `copy`           | `boolean`                                                | `true`                                                 | The Copy button on hover copies the whole source. `false` hides it.                                    |
| `HTMLAttributes` | `Record<string, string>`                                 | `{}`                                                   | Extra attributes for the frame element.                                                                |
| `onStateChange`  | `((event: MermaidStateEvent) => void) \| null`           | `null`                                                 | Called when a diagram's state changes. See [onStateChange](#onstatechange).                            |

The default `limits` were measured on a real iPhone and a real Android phone on 2026-10-21. Each one is the highest level where every test source drew within 200 ms at p99 on both phones. The Android phone set `characters`, and both phones set `edges`. [About Pele](pele.md#measured-on-real-phones) has the numbers.

```ts
Mermaid.configure({
  limits: { characters: 8000 },
  helpLink: false,
  theme: { accent: '#7c3aed', series: ['#7c3aed', '#0ea5e9', '#10b981'] }
})
```

A missing `limits` field keeps its default. `edges` counts arrows in flowchart and agentflow only. Other diagram types have no edge count.

## Commands

The extension registers one command on `editor.commands`.

### `insertMermaid(source?)`

Inserts a new `codeBlock` with `language: 'mermaid'`. With no argument, it inserts this starter:

```
flowchart TD
  A[Start] --> B{Ready?}
  B -- Yes --> C[Done]
  B -- No --> A
```

- An empty string `''` inserts an empty block, and the state is `empty`.
- The caret lands at the end of the new source.
- It returns `false` in three cases. The caret is inside a code parent, the schema has no `codeBlock`, or the block cannot fit at the selection.
- `editor.can().insertMermaid()` tests the first two cases only. It does not test whether the block fits.
- It builds the block from JSON. It never uses `setCodeBlock`, so other content stays as it is.

```ts
editor.chain().focus().insertMermaid().run()
editor.isActive('codeBlock', { language: 'mermaid' }) // true inside a diagram
```

Typing ` ```mermaid ` followed by a space or Enter already works. The code block input rule handles it. That rule matches lowercase letters only.

## States

Every diagram block is in one of six states. The state is the `data-state` value on `view.dom`. Select it as `.mermaid-diagram > [data-state]`.

| State        | When it happens                                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------------------------- |
| `empty`      | The source is blank. Nothing draws, and the diagram host is empty.                                               |
| `loading`    | The first state of a block with source. It lasts until the first draw. A block far from the viewport waits here. |
| `ready`      | Pele drew the source.                                                                                            |
| `error`      | The source did not draw. `error.code` says why. The last diagram stays, dimmed.                                  |
| `load-error` | The Pele chunk did not load, for example offline. The built-in view offers "Try again". The last diagram dims.   |
| `skipped`    | A draw of the same source did not finish earlier in this tab. See [Fixed behaviour](#fixed-behaviour).           |

`MermaidError.code` is one of these:

| Code                  | Meaning                                                                         |
| --------------------- | ------------------------------------------------------------------------------- |
| `syntax`              | Pele could not parse the source. The writer made a mistake.                     |
| `semantic`            | The source parsed, but its content is not valid, for example two mindmap roots. |
| `limit`               | The source is over `limits`, or the drawn SVG is over Pele's output limit.      |
| `unsupported-diagram` | Pele does not draw this diagram type.                                           |
| `render`              | Pele or your `sanitize` threw. It is a bug, not the writer's mistake.           |
| `load`                | The renderer did not load. It comes with the `load-error` state.                |

`diagramType` is the name Pele's `detectType` returns, such as `flowchart` or `sequence`, or `null`.

The built-in view shows these strings:

| Case                               | Text                                                            |
| ---------------------------------- | --------------------------------------------------------------- |
| `load-error`                       | `Could not load the diagram renderer.` and a `Try again` button |
| `skipped`                          | `This diagram was skipped.`                                     |
| `error` with code `limit`          | `This diagram is too large to draw.`                            |
| `error` with `unsupported-diagram` | `This diagram type is not supported.`                           |
| `error` with `render`              | `This diagram could not be drawn.`                              |
| `error` with a line number         | `Line {line}, column {column}: this line has a mistake.`        |
| any other `error`                  | `This diagram has a mistake.`                                   |

Under the message, the view shows Pele's own text, with blank lines removed, in `.mermaid-diagram__detail`.

A `limit` error is different. Its `MermaidError.message` is usually the extension's own sentence, not Pele's. It names the limit, the count where it is known, and a next step, for example `It has more than 250 arrows, and the limit is 250. Split it into smaller diagrams.` The view shows it as body text in `.mermaid-diagram__advice`, and `.mermaid-diagram__detail` stays empty. Pele stops counting edges at the limit, so the edge sentence says "more than". An output that is too big names no number, because the writer never typed it. Pele has other fixed limits, such as nesting depth, block-diagram space blocks and Gantt scheduling work. For those, the message is Pele's own text, because it already names the cause.

`MermaidError.line` and `column` are 1-based, or 0 when there is none. The extension maps Pele's line back to the editor line on a best-effort basis. It was probed on flowchart, sequence, class, er and state diagrams. It skips agentflow, and eventmodeling keeps its comment lines. Do not rely on an exact line.

## onStateChange

`onStateChange(event)` runs on every publish except the first snapshot. That means each state change, and each completed draw, including a draw that stays `ready`. It never runs per keystroke.

Errors follow one rule:

- A text change, local or remote, drops any waiting error and restarts a 1000 ms idle timer.
- An error shows at once when the block is idle, for example when a document loads with a broken diagram.
- Otherwise the error waits for the idle timer. The last good diagram stays at full opacity until then.
- `ready`, `empty`, `load-error` and `skipped` publish at once.
- An error that is shown stays shown, dimmed, until the next publish.

`event` carries `state`, `error`, `diagramType`, `editor`, `getPos` and `durationMs`. `durationMs` is the time of Pele plus the sanitizer, in ms, on `ready` and `error`. It is `null` for other states.

A callback that throws is caught and logged with `console.error`. It never breaks the draw.

## Fixed behaviour

These are not options.

- **Pele options.** `outputLimit` is 1000000, `links` is `false`, and no `icons` resolver is set. `autoDirection` stays on. Each one becomes an option when a developer asks.
- **Timing.** A redraw runs 300 ms after the last text change, local or remote. An error waits 1000 ms of idle.
- **Visibility.** Each diagram block gets its own `IntersectionObserver`, with a margin of 800 px above and below. The first hit draws the block and disconnects that observer. Inside a nested scroll container, such as a scrolling page area, the margin does not pre-mount blocks.
- **Crash marker.** Around each synchronous draw, the extension sets the `sessionStorage` key `mermaid-diagram:rendering:<hash>`. A frozen tab leaves the key, and the next load of that source in the tab shows `skipped`. Pele's own ResizeObserver and font redraws run outside the marker.
- **No writes from the node view.** The node view never sets `language` and never dispatches a transaction. Only `insertMermaid` writes to the document.
- **Removal.** Remove the extension, and the same documents load as plain code blocks.

## Class names and tokens

Classes: `.mermaid-diagram`, `.mermaid-diagram__head`, `.mermaid-diagram__label`, `.mermaid-diagram__icon`, `.mermaid-diagram__text`, `.mermaid-diagram__actions`, `.mermaid-diagram__help`, `.mermaid-diagram__copy`, `.mermaid-diagram__summary`, `.mermaid-diagram__source`, `.mermaid-diagram__fold`, `.mermaid-diagram__preview`, `.mermaid-diagram__diagram`, `.mermaid-diagram__spinner`, `.mermaid-diagram__error`, `.mermaid-diagram__message`, `.mermaid-diagram__advice`, `.mermaid-diagram__detail` and `.mermaid-diagram__retry`.

`.mermaid-diagram__preview` is the root of the built-in view only. A custom `view` brings its own root.

Attributes: `data-source` (`open` or `folded`) on `.mermaid-diagram`, `data-copied` on `.mermaid-diagram__copy` for 2200 ms after a copy, and `data-state` on `view.dom`.

Tokens: `--mermaid-diagram-border` and `--mermaid-diagram-radius`. Colour and font variables are Pele's `--pele-*`. See [Theming](./guide.md#theming).

## TypeScript

```ts
import { Mermaid } from '@docs.plus/extension-mermaid'
import type {
  MermaidError,
  MermaidFold,
  MermaidLimits,
  MermaidOptions,
  MermaidSnapshot,
  MermaidState,
  MermaidStateEvent,
  MermaidTheme,
  MermaidView,
  MermaidViewContext
} from '@docs.plus/extension-mermaid'
```

`Mermaid` is a named export. There is no default export. The `Commands` augmentation adds `insertMermaid` to `editor.commands`. No Pele type appears in the public types, so a Pele release cannot break your build.

`MermaidFold.initial` is read once, when the block's node view is built. A later change of `editor.isEditable` does not refold the block.

## Caveats

- **Only the exact language `mermaid` draws.** A fence tagged `Mermaid` with a capital M stays plain code in Markdown. An HTML round trip keeps only the first word, so ` ```mermaid title ` becomes a diagram there.
- **The editor needs a `codeBlock` node.** Without one, nothing draws and `insertMermaid` returns false.
- **Another `codeBlock` node view wins.** A host `addNodeView`, or an earlier plugin's `nodeViews.codeBlock`, replaces this one silently. This view claims every code block, so a later plugin's `nodeViews.codeBlock` never runs.
- **The head row cannot be replaced.** `view` replaces only the preview, which sits below the source. The head's text and labels are English. To remove the head, set all three of `fold: false`, `helpLink: false` and `copy: false`.
- **Without `styles.css`, the fold control, the head and the actions render unstyled, and Pele's own error box shows.** Add the stylesheet. Or set `fold: false`, `helpLink: false` and `copy: false`, and copy the three rules from [Without `styles.css`](./guide.md#without-stylescss).
- **The default colours need `color-scheme`.** They use `light-dark()`. Set `color-scheme: light dark` on your page, or the light colours always show.
- **Pele has no time limit.** Keep `limits` on. `edges` counts flowchart and agentflow only. See [Security](./security.md).
- **The SVG is not sanitized by default.** Pass `sanitize` when sources come from people you do not trust. See [Sanitizing the SVG](./security.md#sanitizing-the-svg).

More caveats, each with a reason:

- **Layout differs from mermaid.js and GitHub.** Pele has its own layout engine, so the same source gives a different picture.
- **No Mermaid themes, HTML labels, click callbacks or ZenUML.** Theme through `--pele-*` instead. `links` is off, so click callbacks do nothing.
- **`classDef` colours are fixed.** A colour set in the source stays as written. The theme variables do not recolour it.
- **Markdown export always writes a backtick fence.** A source line of ` ``` ` ends the fence early.
- **DOCX and ODT get the source text.** Export does not draw the diagram.
- **Inside a nested scroll container, diagrams mount only near the viewport.** The observer margin is measured against the window, not the container.
- **Zoom is off on touch screens.** `zoom: 'auto'` follows `(pointer: coarse)`.
