import type { HovercardView } from '@docs.plus/extension-hyperlink'
import type { ReactNode, ReactPortal } from 'react'
import { useSyncExternalStore } from 'react'
import { createPortal, flushSync } from 'react-dom'

type Entry = { key: number; element: HTMLElement; node: ReactNode }

const NONE: Entry[] = []

let entries: Entry[] = NONE
let nextKey = 0
const listeners = new Set<() => void>()

const write = (next: Entry[]): void => {
  entries = next
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Card content for the hovercard engine. `flushSync`, because the engine places the card as
 * soon as `render` returns. The engine calls `destroy` once the card has left the page.
 */
export const mountHovercardView = (node: ReactNode): HovercardView => {
  const entry: Entry = { key: nextKey++, element: document.createElement('div'), node }
  // A press must not take focus, so the caret stays in the editor.
  entry.element.addEventListener('mousedown', (e) => e.preventDefault())
  flushSync(() => write([...entries, entry]))
  return {
    element: entry.element,
    destroy: () => write(entries.filter((e) => e !== entry))
  }
}

/** Draws every live hovercard view. Mount once, beside `HyperlinkPopoverPortal`. */
export function HovercardPortal(): ReactPortal[] {
  const live = useSyncExternalStore(
    subscribe,
    () => entries,
    () => NONE
  )
  return live.map(({ key, element, node }) => createPortal(node, element, String(key)))
}
