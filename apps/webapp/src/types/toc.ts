/**
 * TOC list DTO — outline fields only; resolve editor/DOM at action seams.
 */
export interface TocItem {
  id: string
  level: number
  textContent: string
  open: boolean
}

/**
 * Context menu state for TOC
 */
export interface TocContextMenuState {
  headingId: string | null
  isOpen: boolean
}
