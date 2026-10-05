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

export const CARET_FIND_HIT_CAP = 9999
// Paint only a window around the current hit, so a huge count stays cheap to draw.
const CARET_FIND_PAINT_CAP = 200
const PREFILL_MAX_CHARS = 100

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
  /**
   * Bumped when Find picks a hit (open, query, step), so the view scrolls only then,
   * never on a remote edit.
   */
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
  const half = CARET_FIND_PAINT_CAP / 2
  const start = Math.max(0, Math.min(current - half, hits.length - CARET_FIND_PAINT_CAP))
  return DecorationSet.create(
    doc,
    hits.slice(start, start + CARET_FIND_PAINT_CAP).map((hit, i) =>
      Decoration.inline(hit.from, hit.to, {
        class: start + i === current ? 'caret-find-hit caret-find-current' : 'caret-find-hit'
      })
    )
  )
}

// The hit that holds the caret or follows it, so a step from inside hit k lands on k + 1.
function hitAtCaret(hits: FindHit[], pos: number): number {
  if (hits.length === 0) return -1
  const index = hits.findIndex((hit) => hit.to > pos)
  return index === -1 ? 0 : index
}

/**
 * Unfolds only the sections that hide hit `index`. Sections Find opened for the last hit
 * fold again. Temporary folds never persist.
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

  return { current: index, opened, restorePersist, revealSeq: find.revealSeq + 1 }
}

/** Folded ids plus the sections Find opened, so a Filter restore never saves them open. */
export function foldedIdsIncludingFind(state: EditorState): Set<string> {
  const folded = headingFoldPluginKey.getState(state)?.foldedIds ?? new Set<string>()
  const opened = caretFindPluginKey.getState(state)?.opened
  return opened?.size ? new Set([...folded, ...opened]) : folded
}

/** A short selection inside one textblock, as find text; null otherwise. */
function selectionQuery(state: EditorState): string | null {
  const { selection } = state
  if (!(selection instanceof TextSelection) || selection.empty) return null
  const { $from, $to, from, to } = selection
  if (!$from.sameParent($to) || !$from.parent.isTextblock) return null
  if (to - from > PREFILL_MAX_CHARS) return null
  return state.doc.textBetween(from, to, '', OBJECT_CHAR)
}

export function openFindTr(state: EditorState, tr: Transaction): void {
  const find = caretFindPluginKey.getState(state)
  if (!find) return
  let patch: CaretFindPatch = {}
  if (!find.open) {
    // The same text in another case keeps the typed query, so a reopen keeps its casing.
    const selected = selectionQuery(state)
    const query = selected && foldCase(selected) !== foldCase(find.query) ? selected : find.query
    if (query) {
      const { hits, capped } = findHits(tr.doc, query)
      const index = hitAtCaret(hits, state.selection.from)
      patch = { query, hits, capped, ...revealHit(state, tr, find, hits, index) }
    }
  }
  tr.setMeta(caretFindPluginKey, { type: 'open', patch } satisfies CaretFindMeta)
}

export function setFindQueryTr(state: EditorState, tr: Transaction, query: string): void {
  const find = caretFindPluginKey.getState(state)
  // A late debounced query must not paint or unfold behind a closed bar.
  if (!find?.open) return
  const { hits, capped } = findHits(tr.doc, query)
  const index = hitAtCaret(hits, state.selection.from)
  const patch = { query, hits, capped, ...revealHit(state, tr, find, hits, index) }
  tr.setMeta(caretFindPluginKey, { type: 'update', patch } satisfies CaretFindMeta)
}

export function stepFindTr(state: EditorState, tr: Transaction, direction: 1 | -1): boolean {
  const find = caretFindPluginKey.getState(state)
  if (!find?.open || find.hits.length === 0) return false
  const count = find.hits.length
  const index = (find.current + direction + count) % count
  const patch = revealHit(state, tr, find, find.hits, index)
  tr.setSelection(TextSelection.create(tr.doc, find.hits[index].from))
  tr.setMeta(caretFindPluginKey, { type: 'update', patch } satisfies CaretFindMeta)
  return true
}

/**
 * Selects the current hit, then folds back what Find opened, in the persist mode seen
 * before Find touched folds. A hit inside a folded body leaves the caret on its heading.
 */
export function closeFindTr(state: EditorState, tr: Transaction): void {
  const find = caretFindPluginKey.getState(state)
  if (!find) return
  const fold = headingFoldPluginKey.getState(state)
  const hit = find.hits[find.current]
  if (hit) tr.setSelection(TextSelection.create(tr.doc, hit.from, hit.to))

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

        if (!next.query) return next

        // The current hit is the one at the caret. Typing leaves the caret alone, a step puts
        // it on the hit, and a caret move picks a new one. A y-sync change replaces the whole
        // doc, so mapping the old hit loses it, but the restored caret keeps the index.
        if (!tr.docChanged) {
          if (!tr.selectionSet) return next
          const current = hitAtCaret(next.hits, tr.selection.from)
          return current === next.current ? next : withPatch(next, { current }, tr.doc)
        }

        // A full rescan per doc change, only while Find is open; hits cap at 9,999.
        const { hits, capped } = findHits(tr.doc, next.query)
        const current = hitAtCaret(hits, tr.selection.from)
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
          // Instant beats the wrapper's scroll-smooth, so a held Enter and reduced motion jump.
          if (!hit || scrollElementInMobilePadEditor(hit, { behavior: 'instant' })) return
          hit.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })
        }
      }
    }
  })
}
