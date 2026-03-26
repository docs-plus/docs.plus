import type { EditorView } from '@tiptap/pm/view'

/**
 * Find the nearest top-level heading DOM element to the given cursor
 * coordinates. Returns null if no heading is near the cursor.
 * Only considers heading elements that are not the title (first child).
 */
export function findHeadingFromCursor(
  view: EditorView,
  coords: { x: number; y: number }
): { element: HTMLElement; pos: number } | null {
  const children = view.dom.children
  let bestMatch: {
    element: HTMLElement
    pos: number
    distance: number
  } | null = null

  let offset = 0

  for (let i = 0; i < view.state.doc.content.childCount; i++) {
    const child = view.state.doc.content.child(i)
    const nodePos = offset
    offset += child.nodeSize

    if (i === 0) continue
    if (child.type.name !== 'heading') continue

    const dom = children[i]
    if (!(dom instanceof HTMLElement)) continue

    const rect = dom.getBoundingClientRect()

    if (coords.y >= rect.top && coords.y <= rect.bottom) {
      return { element: dom, pos: nodePos }
    }

    const distTop = Math.abs(coords.y - rect.top)
    const distBottom = Math.abs(coords.y - rect.bottom)
    const distance = Math.min(distTop, distBottom)

    if (!bestMatch || distance < bestMatch.distance) {
      bestMatch = { element: dom, pos: nodePos, distance }
    }

    if (coords.y < rect.top && bestMatch) {
      break
    }
  }

  if (bestMatch && bestMatch.distance < 20) {
    return { element: bestMatch.element, pos: bestMatch.pos }
  }

  return null
}
