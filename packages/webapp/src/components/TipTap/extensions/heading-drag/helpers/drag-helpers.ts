import type { Node as PMNode } from '@tiptap/pm/model'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'

export const DRAG_THRESHOLD = 4
export const AUTO_SCROLL_ZONE = 50
export const AUTO_SCROLL_SPEED = 15

export interface DragInfo {
  headingPos: number
  headingLevel: number
  sectionFrom: number
  sectionTo: number
  ghostEl: HTMLElement | null
  indicatorEl: HTMLElement | null
  scrollInterval: ReturnType<typeof setInterval> | null
  onDocMouseMove: ((e: MouseEvent) => void) | null
  onDocMouseUp: ((e: MouseEvent) => void) | null
  onBlur: (() => void) | null
  rafId: number
}

export type ViewWithObserver = {
  domObserver?: { stop(): void; start(): void }
}

export const dragStates = new WeakMap<EditorView, DragInfo>()

export function buildHandleDecos(doc: PMNode): DecorationSet {
  const decos: Decoration[] = []
  doc.forEach((node, pos) => {
    if (node.type.name === 'heading' && pos > 0) {
      decos.push(
        Decoration.node(pos, pos + node.nodeSize, {
          class: 'has-drag-handle'
        })
      )
    }
  })
  return decos.length > 0 ? DecorationSet.create(doc, decos) : DecorationSet.empty
}

export function getScrollParent(el: HTMLElement): HTMLElement {
  let current = el.parentElement
  while (current) {
    const { overflowY } = getComputedStyle(current)
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return current
    }
    current = current.parentElement
  }
  return document.documentElement
}

export function findDropTarget(
  view: EditorView,
  clientY: number,
  sectionFrom: number,
  sectionTo: number
): { pos: number; y: number } | null {
  const { doc } = view.state
  const domChildren = view.dom.children
  let result: { pos: number; y: number } | null = null
  let offset = 0

  for (let i = 0; i < doc.content.childCount; i++) {
    const child = doc.content.child(i)
    const nodePos = offset
    offset += child.nodeSize

    if (i === 0) continue
    if (nodePos >= sectionFrom && nodePos < sectionTo) continue

    const dom = domChildren[i]
    if (!(dom instanceof HTMLElement)) continue

    const rect = dom.getBoundingClientRect()

    if (result && clientY < rect.top) {
      const gapMid = (result.y + rect.top) / 2
      return clientY < gapMid ? result : { pos: nodePos, y: rect.top }
    }

    if (clientY < rect.top + rect.height / 2) {
      return { pos: nodePos, y: rect.top }
    }

    result = { pos: offset, y: rect.bottom }
  }

  return result
}

export function applySectionFeedback(view: EditorView, from: number, to: number): void {
  const { doc } = view.state
  const domChildren = view.dom.children
  ;(view as unknown as ViewWithObserver).domObserver?.stop()
  let offset = 0
  for (let i = 0; i < doc.content.childCount; i++) {
    const child = doc.content.child(i)
    const nodePos = offset
    offset += child.nodeSize
    if (nodePos >= from && nodePos < to) {
      const dom = domChildren[i]
      if (dom instanceof HTMLElement) {
        dom.classList.add('heading-section-dragging')
      }
    }
  }
  ;(view as unknown as ViewWithObserver).domObserver?.start()
}

export function cleanupDrag(view: EditorView): void {
  const info = dragStates.get(view)
  if (!info) return

  info.ghostEl?.remove()
  info.indicatorEl?.remove()
  cancelAnimationFrame(info.rafId)

  if (info.scrollInterval != null) {
    clearInterval(info.scrollInterval)
  }

  if (info.onDocMouseMove) {
    document.removeEventListener('mousemove', info.onDocMouseMove)
  }
  if (info.onDocMouseUp) {
    document.removeEventListener('mouseup', info.onDocMouseUp)
  }
  if (info.onBlur) {
    view.dom.removeEventListener('blur', info.onBlur)
  }

  document.documentElement.classList.remove('heading-dragging')
  ;(view as unknown as ViewWithObserver).domObserver?.stop()
  for (const el of view.dom.querySelectorAll('.heading-section-dragging')) {
    el.classList.remove('heading-section-dragging')
  }
  ;(view as unknown as ViewWithObserver).domObserver?.start()

  dragStates.delete(view)
}
