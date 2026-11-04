import type { MouseEvent } from 'react'

/** A modified click (new tab or window) belongs to the browser, so the row lets it through. */
export const isPlainLeftClick = (e: MouseEvent) =>
  e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
