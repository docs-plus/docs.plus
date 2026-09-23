import type { Node as PMNode } from '@tiptap/pm/model'
import {
  type EditorState,
  Plugin,
  PluginKey,
  TextSelection,
  type Transaction
} from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { scrollElementInMobilePadEditor } from '@utils/scrollMobilePadEditor'

import { type HeadingFoldMeta, headingFoldPluginKey } from '../heading-fold'
import { computeSection } from '../shared'

export const CARET_FIND_HIT_CAP = 200

interface FindHit {
  from: number
  to: number
}

interface CaretFindState {
  open: boolean
  query: string
  hits: FindHit[]
  capped: boolean
  current: number
  /** Folded sections Find opened so the current hit shows. */
  opened: Set<string>
  /** Fold persist mode from before Find first changed folds; null while Find has not. */
  restorePersist: boolean | null
  /** Bumped on an explicit step so the view scrolls only then, never on remote edits. */
  revealSeq: number
  decos: DecorationSet
}

type CaretFindPatch = Partial<
  Pick<
    CaretFindState,
    'query' | 'hits' | 'capped' | 'current' | 'opened' | 'restorePersist' | 'revealSeq'
  >
>

type CaretFindMeta =
  | { type: 'open'; patch: CaretFindPatch }
  | { type: 'close' }
  | { type: 'update'; patch: CaretFindPatch }

export const caretFindPluginKey = new PluginKey<CaretFindState>('caretFind')

// Leaf inline nodes (images, breaks) stand in as one char each so no hit spans them.
const OBJECT_CHAR = '\uFFFC'

// Per code point, and only when the length holds, so a string index stays a doc offset.
function foldCase(text: string): string {
  let out = ''
  for (const ch of text) {
    const lower = ch.toLowerCase()
    out += lower.length === ch.length ? lower : ch
  }
  return out
}

/** Literal, case-insensitive hits in every textblock, Title included, in doc order. */
function findHits(
  doc: PMNode,
  query: string,
  cap = CARET_FIND_HIT_CAP
): { hits: FindHit[]; capped: boolean } {
  const needle = foldCase(query)
  const hits: FindHit[] = []
  let capped = false
  if (!needle) return { hits, capped }

  doc.descendants((node, pos) => {
    if (capped) return false
    if (!node.isTextblock) return true

    let text = ''
    node.forEach((child) => {
      text += child.isText ? (child.text ?? '') : OBJECT_CHAR.repeat(child.nodeSize)
    })
    const haystack = foldCase(text)
    const start = pos + 1

    let at = haystack.indexOf(needle)
    while (at !== -1) {
      if (hits.length === cap) {
        capped = true
        break
      }
      hits.push({ from: start + at, to: start + at + needle.length })
      at = haystack.indexOf(needle, at + needle.length)
    }
    return false
  })

  return { hits, capped }
}

/** Folded sections whose hidden body holds `pos`, outermost first. */
function foldedSectionsAt(
  doc: PMNode,
  pos: number,
  foldedIds: Set<string>
): { id: string; headingEnd: number }[] {
  const found: { id: string; headingEnd: number }[] = []
  if (foldedIds.size === 0) return found

  let offset = 0
  for (let i = 0; i < doc.childCount; i++) {
    const child = doc.child(i)
    const nodePos = offset
    offset += child.nodeSize
    if (nodePos > pos) break
    if (child.type.name !== 'heading') continue

    const id = child.attrs['toc-id'] as string | undefined
    if (!id || !foldedIds.has(id) || pos < offset) continue

    const { to } = computeSection(doc, nodePos, child.attrs.level as number, i)
    if (pos < to) found.push({ id, headingEnd: offset - 1 })
  }
  return found
}

function sameIds(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const id of a) if (!b.has(id)) return false
  return true
}

function buildDecorations(doc: PMNode, hits: FindHit[], current: number): DecorationSet {
  if (hits.length === 0) return DecorationSet.empty
  return DecorationSet.create(
    doc,
    hits.map((hit, i) =>
      Decoration.inline(hit.from, hit.to, {
        class: i === current ? 'caret-find-hit caret-find-current' : 'caret-find-hit'
      })
    )
  )
}

function firstHitFrom(hits: FindHit[], pos: number): number {
  if (hits.length === 0) return -1
  const index = hits.findIndex((hit) => hit.from >= pos)
  return index === -1 ? 0 : index
}

/**
 * Moves the caret to hit `index` and unfolds only the sections that hide it.
 * Sections Find opened for the last hit fold again. Temporary folds never persist.
 */
function revealHit(
  state: EditorState,
  tr: Transaction,
  find: Pick<CaretFindState, 'opened' | 'restorePersist' | 'revealSeq'>,
  hits: FindHit[],
  index: number
): CaretFindPatch {
  const hit = hits[index]
  let { opened, restorePersist } = find
  const fold = headingFoldPluginKey.getState(state)

  if (fold) {
    const all = new Set([...fold.foldedIds, ...opened])
    const needed = new Set(hit ? foldedSectionsAt(tr.doc, hit.from, all).map((s) => s.id) : [])
    const next = new Set([...all].filter((id) => !needed.has(id)))
    opened = needed
    if (!sameIds(next, fold.foldedIds)) {
      if (restorePersist === null) restorePersist = !fold.skipPersist
      tr.setMeta(headingFoldPluginKey, {
        type: 'set',
        ids: next,
        persist: false
      } satisfies HeadingFoldMeta)
    }
  }

  if (hit) tr.setSelection(TextSelection.create(tr.doc, hit.from))
  return { current: index, opened, restorePersist, revealSeq: find.revealSeq + 1 }
}

/** Folded ids plus the sections Find opened, so a Filter restore never saves them open. */
export function foldedIdsIncludingFind(state: EditorState): Set<string> {
  const folded = headingFoldPluginKey.getState(state)?.foldedIds ?? new Set<string>()
  const opened = caretFindPluginKey.getState(state)?.opened
  return opened?.size ? new Set([...folded, ...opened]) : folded
}

export function openFindTr(state: EditorState, tr: Transaction): void {
  const find = caretFindPluginKey.getState(state)
  if (!find) return
  let patch: CaretFindPatch = {}
  if (!find.open && find.query) {
    const { hits, capped } = findHits(tr.doc, find.query)
    const index = firstHitFrom(hits, state.selection.from)
    patch = { hits, capped, ...revealHit(state, tr, find, hits, index) }
  }
  tr.setMeta(caretFindPluginKey, { type: 'open', patch } satisfies CaretFindMeta)
}

export function setFindQueryTr(state: EditorState, tr: Transaction, query: string): void {
  const find = caretFindPluginKey.getState(state)
  if (!find) return
  const { hits, capped } = findHits(tr.doc, query)
  const index = firstHitFrom(hits, state.selection.from)
  const patch = { query, hits, capped, ...revealHit(state, tr, find, hits, index) }
  tr.setMeta(caretFindPluginKey, { type: 'update', patch } satisfies CaretFindMeta)
}

export function stepFindTr(state: EditorState, tr: Transaction, direction: 1 | -1): boolean {
  const find = caretFindPluginKey.getState(state)
  if (!find?.open || find.hits.length === 0) return false
  const count = find.hits.length
  const index = (find.current + direction + count) % count
  const patch = revealHit(state, tr, find, find.hits, index)
  tr.setMeta(caretFindPluginKey, { type: 'update', patch } satisfies CaretFindMeta)
  return true
}

/**
 * Folds back what Find opened, in the persist mode seen before Find touched folds.
 * A caret left inside a folded body moves up to that section's heading line.
 */
export function closeFindTr(state: EditorState, tr: Transaction): void {
  const find = caretFindPluginKey.getState(state)
  if (!find) return
  const fold = headingFoldPluginKey.getState(state)

  if (fold && find.restorePersist !== null) {
    const ids = new Set([...fold.foldedIds, ...find.opened])
    tr.setMeta(headingFoldPluginKey, {
      type: 'set',
      ids,
      persist: find.restorePersist
    } satisfies HeadingFoldMeta)
    const [outer] = foldedSectionsAt(tr.doc, tr.selection.head, ids)
    if (outer) tr.setSelection(TextSelection.near(tr.doc.resolve(outer.headingEnd), -1))
  }
  tr.setMeta(caretFindPluginKey, { type: 'close' } satisfies CaretFindMeta)
}

function closedState(query: string, revealSeq: number): CaretFindState {
  return {
    open: false,
    query,
    hits: [],
    capped: false,
    current: -1,
    opened: new Set(),
    restorePersist: null,
    revealSeq,
    decos: DecorationSet.empty
  }
}

function withPatch(prev: CaretFindState, patch: CaretFindPatch, doc: PMNode): CaretFindState {
  const next = { ...prev, ...patch }
  return { ...next, decos: buildDecorations(doc, next.hits, next.current) }
}

export function createCaretFindPlugin(): Plugin<CaretFindState> {
  return new Plugin<CaretFindState>({
    key: caretFindPluginKey,

    state: {
      init: () => closedState('', 0),

      apply(tr, prev): CaretFindState {
        const meta = tr.getMeta(caretFindPluginKey) as CaretFindMeta | undefined

        if (meta?.type === 'close') return closedState(prev.query, prev.revealSeq)
        if (meta?.type === 'open') return withPatch({ ...prev, open: true }, meta.patch, tr.doc)
        if (meta?.type === 'update') return withPatch(prev, meta.patch, tr.doc)
        if (!prev.open) return prev

        let next = prev
        // A fold `set` from Filter now owns the fold state and its persist mode.
        const foldMeta = tr.getMeta(headingFoldPluginKey) as HeadingFoldMeta | undefined
        if (foldMeta?.type === 'set' && prev.restorePersist !== null) {
          next = { ...next, opened: new Set(), restorePersist: null }
        }

        if (!tr.docChanged || !next.query) return next

        // A full rescan per doc change is fine: hits cap at 200, and only while Find is open.

        const { hits, capped } = findHits(tr.doc, next.query)
        const anchor = prev.hits[prev.current]
        const current = firstHitFrom(hits, anchor ? tr.mapping.map(anchor.from) : tr.selection.from)
        return withPatch(next, { hits, capped, current }, tr.doc)
      }
    },

    props: {
      decorations(state) {
        return caretFindPluginKey.getState(state)?.decos ?? DecorationSet.empty
      }
    },

    view() {
      return {
        update(view, prevState) {
          const find = caretFindPluginKey.getState(view.state)
          if (!find || find.revealSeq === caretFindPluginKey.getState(prevState)?.revealSeq) return
          // The find input holds focus, so ProseMirror's own scrollIntoView does nothing.
          const hit = view.dom.querySelector('.caret-find-current')
          if (!hit || scrollElementInMobilePadEditor(hit)) return
          hit.scrollIntoView({ block: 'center', inline: 'nearest' })
        }
      }
    }
  })
}
