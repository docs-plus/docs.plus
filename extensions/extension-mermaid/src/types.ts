import type { Editor } from '@tiptap/core'

export interface MermaidOptions {
  /** Pele colour and font variables, set on each frame. Values are CSS, so `var()` and `light-dark()` work. */
  theme: MermaidTheme | null // default null (Pele or styles.css defaults)
  /** Replaces the built-in preview. Return the element Pele draws into. */
  view: ((context: MermaidViewContext) => MermaidView) | null // default null (built-in view)
  /** Host sanitizer for each SVG string before it enters the page. */
  sanitize: ((svg: string) => Node) | null // default null
  /** Remote images make every viewer of a shared document fetch the URL. */
  images: boolean // default false
  /** Pele zoom controls on fine pointers. Always off on coarse pointers. */
  zoom: 'auto' | false // default 'auto'
  /** Sources over these limits show a `limit` error and are never drawn. */
  limits: MermaidLimits // default { characters: 10000, edges: 250 }, measured on phones
  /** Lets each viewer hide the source. Nothing is stored in the document. `false` removes the button. */
  fold: MermaidFold | false // default { initial: 'folded-when-read-only', remember: true }
  /** The "Syntax" button on hover opens this guide. `false` hides it. */
  helpLink: string | false // default 'https://mermaid.js.org/intro/syntax-reference.html'
  /** The Copy button on hover copies the whole source. `false` hides it. */
  copy: boolean // default true
  /** Extra attributes for the frame element. */
  HTMLAttributes: Record<string, string> // default {}
  /** Called when a diagram's state changes. Errors wait for the idle delay while the source changes, never per keystroke.
   *  Also fires after each redraw of a ready diagram. */
  onStateChange: ((event: MermaidStateEvent) => void) | null // default null
}

export interface MermaidFold {
  /** Where a block starts. 'folded-when-read-only' folds it when the editor is not editable. */
  initial?: 'open' | 'folded' | 'folded-when-read-only'
  /** Remembers each viewer's own choice in localStorage, keyed by the source text. */
  remember?: boolean
}

export interface MermaidTheme {
  background?: string
  foreground?: string
  muted?: string
  line?: string
  surface?: string
  surfaceAlt?: string
  border?: string
  accent?: string
  critical?: string
  fontFamily?: string
  fontFamilyMono?: string
  radius?: string
  /** Chart and category colours. Pele repeats them after 8. */
  series?: readonly string[]
}

export interface MermaidLimits {
  /** Maximum source length in characters. */
  characters?: number
  /** Maximum arrows (edges) in one diagram. Pele counts edges in flowchart and agentflow only. */
  edges?: number
}

export type MermaidState = 'empty' | 'loading' | 'ready' | 'error' | 'load-error' | 'skipped'

export interface MermaidError {
  /** `render` means Pele or `sanitize` threw: a bug, not the writer's mistake. */
  code: 'syntax' | 'semantic' | 'limit' | 'unsupported-diagram' | 'load' | 'render'
  message: string
  line: number // 1-based, 0 if none
  column: number // 1-based, 0 if none
}

export interface MermaidSnapshot {
  state: MermaidState
  error: MermaidError | null
  diagramType: string | null // from Pele detectType, for example 'flowchart'
}

export interface MermaidViewContext {
  editor: Editor
  getPos: () => number | undefined
  /** Loads the renderer again after a load-error. */
  retry: () => void
}

export interface MermaidView {
  dom: HTMLElement // placed under the source
  diagram: HTMLElement // the extension mounts Pele here
  update?: (snapshot: MermaidSnapshot) => void
  destroy?: () => void
}

export interface MermaidStateEvent extends MermaidSnapshot {
  editor: Editor
  getPos: () => number | undefined
  /** Render time (Pele plus sanitize) in ms on `ready` and `error`; null otherwise. */
  durationMs: number | null
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mermaid: { insertMermaid: (source?: string) => ReturnType }
  }
}
