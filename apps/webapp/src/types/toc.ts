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

/** One top-level heading as a tree node. `parentId` null means the root. */
export interface TocOutlineNode {
  id: string
  level: number
  text: string
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

/** Where a drag lets go: between two visible rows, or onto a row to nest inside it. */
export type TocDropTarget =
  { kind: 'gap'; upperId: string | null; lowerId: string | null } | { kind: 'inside'; id: string }

export interface TocTreeMovePlan {
  ok: true
  /** The source section `[from, to)` in the planned document. */
  from: number
  to: number
  /** Where the section goes, before the delete is mapped. */
  insertPos: number
  /** Added to every heading level in the set; the source lands at its level plus this. */
  levelShift: number
  parentId: string | null
}

export type TocTreeMoveResult = TocTreeMovePlan | { ok: false; reason: TocTreeMoveRefusal }
