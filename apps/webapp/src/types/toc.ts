/**
 * TOC list DTO — outline fields only; resolve editor/DOM at action seams.
 */
export interface TocItem {
  id: string
  level: number
  textContent: string
  open: boolean
  /** The first document line as an H1. It never moves (ruling R3). */
  isTitle: boolean
}

export interface TocContextMenuState {
  headingId: string | null
  isOpen: boolean
}

/** One top-level heading as a tree node. `parentId` null means the root. */
export interface TocOutlineNode {
  id: string
  level: number
  pos: number
  sectionTo: number
  parentId: string | null
  index: number
  isTitle: boolean
}

/** A slot in a parent's child list, counted with the source still in place. */
export interface TocTreeAddress {
  parentId: string | null
  index: number
}

export type TocTreeMoveRefusal =
  'locked' | 'not-found' | 'title-fixed' | 'above-title' | 'inside-own-set' | 'no-room' | 'noop'

export interface TocTreeMovePlan {
  ok: true
  sourceId: string
  /** The source section `[from, to)` in the planned document. */
  from: number
  to: number
  /** Where the section goes, before the delete is mapped. */
  insertPos: number
  /** Start of the moved section after the move; selection maps by `landedFrom - from`. */
  landedFrom: number
  L: number
  d: number
  parentId: string | null
}

export type TocTreeMoveResult = TocTreeMovePlan | { ok: false; reason: TocTreeMoveRefusal }
