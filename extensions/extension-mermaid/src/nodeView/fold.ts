import { type PluginView, TextSelection } from '@tiptap/pm/state'
import type { EditorView, ViewMutationRecord } from '@tiptap/pm/view'

import { hashSource } from '../hashSource'
import type { MermaidOptions } from '../types'
import { element } from '../view/element'
import { createIcon, createText } from '../view/icons'
import { copyText } from './copy'

const FOLD_KEY = 'mermaid-diagram:fold:'
const COPIED_MS = 2200

const ARROWS: Record<string, { dir: 'up' | 'down' | 'left' | 'right'; forward: boolean }> = {
  ArrowDown: { dir: 'down', forward: true },
  ArrowRight: { dir: 'right', forward: true },
  ArrowUp: { dir: 'up', forward: false },
  ArrowLeft: { dir: 'left', forward: false }
}

/** One block's head: the label, Syntax, Copy, the fold button and the summary. */
export interface Head {
  /** Call with each new source text. An emptied block opens without a stored choice. */
  setSource(source: string): void
  ignoreMutation(mutation: ViewMutationRecord): boolean
  stopEvent(event: Event): boolean
  destroy(): void
}

/** Per-editor fold state. The plugin parts and the heads share one registry. */
export interface Folds {
  /** Builds the head and reads the start state once. It prepends nothing when every control is off. */
  head(frame: HTMLElement, source: string, editable: boolean): Head
  view: () => PluginView
  handleKeyDown: (view: EditorView, event: KeyboardEvent) => boolean
}

interface Block {
  folded: boolean
  open(): void
}

function describeLines(source: string): string {
  const count = source.split('\n').length
  return `Mermaid source · ${count} ${count === 1 ? 'line' : 'lines'} hidden`
}

function button(
  className: string,
  text: HTMLSpanElement,
  icon: HTMLSpanElement
): HTMLButtonElement {
  const el = element('button', className)
  el.type = 'button'
  el.append(icon, text)
  return el
}

export function createFolds({
  fold,
  helpLink,
  copy
}: Pick<MermaidOptions, 'fold' | 'helpLink' | 'copy'>): Folds {
  const blocks = new WeakMap<Node, Block>()
  // `configure()` merges the defaults, but an explicit `undefined` still reaches here.
  const remember = fold !== false && fold.remember !== false

  const blockAt = (view: EditorView, pos: number): Block | undefined => {
    const dom = view.nodeDOM(pos)
    return dom ? blocks.get(dom) : undefined
  }

  function start(source: string, editable: boolean): boolean {
    if (fold === false || source.trim() === '') return false
    if (remember) {
      try {
        const stored = localStorage.getItem(FOLD_KEY + hashSource(source))
        if (stored === '1') return true
        if (stored === '0') return false
      } catch {
        // Storage is optional; fall through to `initial`.
      }
    }
    const initial = fold.initial ?? 'folded-when-read-only'
    return initial === 'folded' || (initial === 'folded-when-read-only' && !editable)
  }

  function save(source: string, folded: boolean): void {
    if (!remember) return
    try {
      localStorage.setItem(FOLD_KEY + hashSource(source), folded ? '1' : '0')
    } catch {
      // Storage is optional; the choice then lasts for this block only.
    }
  }

  function head(frame: HTMLElement, initialSource: string, editable: boolean): Head {
    let source = initialSource
    let copyTimer: ReturnType<typeof setTimeout> | undefined
    let destroyed = false

    // Parts for a disabled option stay detached, so the setters need no null checks.
    const summary = element('span', 'mermaid-diagram__summary')
    const foldText = createText('Hide source')
    const foldButton = button('mermaid-diagram__fold', foldText, createIcon('chevron'))
    const copyLabel = createText('Copy')
    const copyButton = button('mermaid-diagram__copy', copyLabel, createIcon('copy', 'check'))

    const setFolded = (folded: boolean): void => {
      block.folded = folded
      frame.dataset.source = folded ? 'folded' : 'open'
      summary.textContent = describeLines(source)
      foldButton.setAttribute('aria-expanded', String(!folded))
      // The text span is hidden on touch screens, so the button needs its own name.
      const name = folded ? 'Show source' : 'Hide source'
      foldButton.setAttribute('aria-label', name)
      foldText.textContent = name
    }
    const block: Block = { folded: false, open: () => setFolded(false) }

    const setCopied = (on: boolean): void => {
      copyButton.toggleAttribute('data-copied', on)
      copyButton.setAttribute('aria-label', on ? 'Copied' : 'Copy Mermaid source')
      copyLabel.textContent = on ? 'Copied' : 'Copy'
    }

    foldButton.addEventListener('click', () => {
      if (!block.folded && source.trim() === '') return
      setFolded(!block.folded)
      save(source, block.folded)
    })
    summary.addEventListener('click', () => {
      if (!block.folded) return
      setFolded(false)
      save(source, false)
    })
    copyButton.addEventListener('click', () => {
      void copyText(source).then((ok) => {
        if (!ok || destroyed) return
        setCopied(true)
        clearTimeout(copyTimer)
        copyTimer = setTimeout(() => setCopied(false), COPIED_MS)
      })
    })
    setCopied(false)

    const el = element('div', 'mermaid-diagram__head')
    el.contentEditable = 'false'
    const label = element('span', 'mermaid-diagram__label')
    label.textContent = 'mermaid'
    const actions = element('div', 'mermaid-diagram__actions')
    // A button, not a link: a link extension in the same editor takes every `<a>` click.
    if (helpLink) {
      const help = button('mermaid-diagram__help', createText('Syntax'), createIcon('help'))
      help.setAttribute('aria-label', 'Mermaid syntax guide (opens in a new tab)')
      help.addEventListener('click', () => {
        window.open(helpLink, '_blank', 'noopener,noreferrer')
      })
      actions.append(help)
    }
    if (copy !== false) actions.append(copyButton)
    if (fold !== false) {
      actions.append(foldButton)
      el.append(summary)
    }
    el.append(label, actions)
    if (fold !== false || helpLink || copy !== false) frame.prepend(el)

    setFolded(start(source, editable))
    blocks.set(frame, block)

    return {
      setSource(next) {
        source = next
        summary.textContent = describeLines(next)
        if (block.folded && next.trim() === '') setFolded(false)
      },
      ignoreMutation(mutation) {
        if (el.contains(mutation.target)) return true
        // Without this, ProseMirror would rebuild the node view on every fold.
        return (
          mutation.type === 'attributes' &&
          mutation.target === frame &&
          mutation.attributeName === 'data-source'
        )
      },
      stopEvent(event) {
        return event.target instanceof Node && el.contains(event.target)
      },
      destroy() {
        destroyed = true
        clearTimeout(copyTimer)
        blocks.delete(frame)
      }
    }
  }

  return {
    head,

    // A caret in hidden source is lost to the writer, so the block opens without a stored choice.
    // Read-only views skip it: their default selection sits at the document start.
    view: () => ({
      update(view, prev) {
        const { selection } = view.state
        if (!view.editable || prev.selection.eq(selection)) return
        const { $from } = selection
        if ($from.depth === 0) return
        const block = blockAt(view, $from.before())
        if (block?.folded) block.open()
      }
    }),

    // A folded source is `visibility: hidden`, so the browser caret skips it. The key step goes in
    // by hand, and the plugin view then opens the block because the selection is inside it.
    handleKeyDown(view, event) {
      const arrow = ARROWS[event.key]
      if (
        !arrow ||
        !view.editable ||
        event.shiftKey ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return false
      }
      const { selection } = view.state
      // A gap cursor has depth 0 and no textblock, so endOfTextblock would throw on it.
      if (!(selection instanceof TextSelection) || !selection.empty) return false
      if (!view.endOfTextblock(arrow.dir)) return false

      const { $head } = selection
      const edge = arrow.forward ? $head.after() : $head.before()
      const next = arrow.forward
        ? view.state.doc.resolve(edge).nodeAfter
        : view.state.doc.resolve(edge).nodeBefore
      if (!next) return false

      // Only diagram blocks are registered. A miss is another node, and an open block is not folded.
      const start = arrow.forward ? edge : edge - next.nodeSize
      if (!blockAt(view, start)?.folded) return false

      const inside = arrow.forward ? start + 1 : start + next.nodeSize - 1
      view.dispatch(
        view.state.tr.setSelection(TextSelection.create(view.state.doc, inside)).scrollIntoView()
      )
      return true
    }
  }
}
