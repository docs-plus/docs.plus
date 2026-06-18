import type { Editor } from '@tiptap/core'
import type { DOMOutputSpec, Node as ProseMirrorNode } from '@tiptap/pm/model'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'

import { setMediaCaption } from './utils/media-node-attrs'

/** Single reader for the nullable `caption` attr so node views don't repeat the cast. */
export function readCaption(node: ProseMirrorNode): string | null {
  return (node.attrs.caption as string | null) ?? null
}

/** NodeSelection can outlive caption DOM focus; collapse it before typing replaces the node. */
function releaseMediaNodeSelectionForCaption(
  editor: Editor,
  getPos: () => number | undefined
): void {
  const pos = getPos()
  if (pos == null || !editor.isEditable) return

  const { state } = editor
  const { selection } = state
  if (!(selection instanceof NodeSelection) || selection.from !== pos) return

  const after = state.doc.resolve(Math.min(pos + selection.node.nodeSize, state.doc.content.size))
  editor.view.dispatch(state.tr.setSelection(TextSelection.near(after, -1)))
}

export interface CaptionHandle {
  el: HTMLElement
  sync: (caption: string | null) => void
  destroy: () => void
}

interface CaptionParams {
  editor: Editor
  getPos: () => number | undefined
  initial: string | null
}

/** Editable figcaption committed to the `caption` attr on blur/Enter. Chrome, not PM content. */
export function createCaptionElement({ editor, getPos, initial }: CaptionParams): CaptionHandle {
  const el = document.createElement('figcaption')
  el.className = 'hm-caption'
  el.dataset.placeholder = 'Add a caption…'
  el.setAttribute('contenteditable', editor.isEditable ? 'true' : 'false')
  el.textContent = initial ?? ''
  if (!initial) el.classList.add('hm-caption--empty')

  const commit = () => {
    if (!editor.isEditable) return
    const pos = getPos()
    if (pos == null) return
    setMediaCaption(editor, pos, el.textContent?.trim() || null)
  }
  // editable toggles (read ↔ edit mode) don't rebuild this island, so reject edits live.
  const onFocus = () => {
    if (!editor.isEditable) {
      el.blur()
      return
    }
    el.classList.remove('hm-caption--empty')
    releaseMediaNodeSelectionForCaption(editor, getPos)
  }
  const onBlur = () => {
    commit()
    if (!el.textContent?.trim()) el.classList.add('hm-caption--empty')
  }
  const onKeyDown = (event: KeyboardEvent) => {
    event.stopPropagation()
    if (!editor.isEditable) {
      event.preventDefault()
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      commit()
      el.blur()
      editor.commands.focus()
    }
  }
  const stop = (event: Event) => event.stopPropagation()

  el.addEventListener('focus', onFocus)
  el.addEventListener('blur', onBlur)
  el.addEventListener('keydown', onKeyDown)
  el.addEventListener('beforeinput', stop)
  el.addEventListener('mousedown', stop)
  el.addEventListener('paste', stop)

  return {
    el,
    sync: (caption) => {
      el.setAttribute('contenteditable', editor.isEditable ? 'true' : 'false')
      if (el === document.activeElement) return
      const next = caption ?? ''
      if (el.textContent !== next) el.textContent = next
      el.classList.toggle('hm-caption--empty', !next)
    },
    destroy: () => {
      el.removeEventListener('focus', onFocus)
      el.removeEventListener('blur', onBlur)
      el.removeEventListener('keydown', onKeyDown)
      el.removeEventListener('beforeinput', stop)
      el.removeEventListener('mousedown', stop)
      el.removeEventListener('paste', stop)
    }
  }
}

/** Figure-aware element finder for attribute parseHTML (handles bare media or figure>media). */
export function mediaElementFrom(el: HTMLElement, selector: string): HTMLElement | null {
  if (el.matches(selector)) return el
  return el.querySelector<HTMLElement>(selector)
}

/** Reusable `caption` attribute spec: parses figcaption text; never emits an HTML attribute. */
export function captionAttribute(): {
  default: string | null
  parseHTML: (element: HTMLElement) => string | null
  renderHTML: () => Record<string, never>
} {
  return {
    default: null as string | null,
    parseHTML: (element: HTMLElement) =>
      element.tagName === 'FIGURE'
        ? element.querySelector('figcaption')?.textContent?.trim() || null
        : null,
    renderHTML: () => ({})
  }
}

/** Wrap a rendered media spec in `<figure>…<figcaption>` when caption is present. */
export function wrapRenderWithCaption(
  rendered: DOMOutputSpec,
  caption: string | null,
  figureStyle = ''
): DOMOutputSpec {
  if (!caption) return rendered
  return [
    'figure',
    { 'data-hm-figure': '', class: 'hypermultimedia--figure', style: figureStyle },
    rendered,
    ['figcaption', { class: 'hm-caption' }, caption]
  ] as DOMOutputSpec
}
