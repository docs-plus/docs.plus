import {
  combineTransactionSteps,
  type Editor,
  getChangedRanges,
  getMarkRange,
  type MappablePosition,
  type Range
} from '@tiptap/core'
import { closeHistory } from '@tiptap/pm/history'
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state'
import { find } from 'linkifyjs'

import { PREVENT_AUTOLINK_META } from '../constants'
import type { LinkContext } from '../interactions/types'
import { logger } from '../utils/logger'
import { cleanTitle } from './cleanTitle'
import type { PasteTitleOptions } from './types'

const DEADLINE_MS = 4000
const MAX_RUNS = 5
/** Set on the swap transaction, so a host can tell it apart from an edit. */
const PASTE_TITLE_META = 'pasteTitle'
// Tiptap's collaboration extension starts a new y-undo step on this meta, as for an input rule.
const INPUT_RULE_META = 'inputRule'

/** A paste seen at its DOM event. Its paste transaction turns it into a run, or drops it. */
type Armed = {
  /** The trimmed clipboard text. The link text must equal it. */
  text: string
  /** The href the paste rule stores for this text, after every URL gate. */
  href: string
  plain: boolean
}

type Run = {
  text: string
  href: string
  /** One inner character of the link, so an insert at either edge never shifts it. */
  anchor: MappablePosition
  controller: AbortController
  deadline: ReturnType<typeof setTimeout>
}

/** Internal per-editor state, kept in extension storage because plugin views rebuild. */
export interface PasteTitleState {
  armed: Armed | null
  runs: Set<Run>
  warnedShouldFetch: boolean
  warnedAnswer: boolean
}

export function createPasteTitleState(): PasteTitleState {
  return { armed: null, runs: new Set(), warnedShouldFetch: false, warnedAnswer: false }
}

/** Observes the paste and never takes it over: every hook lets ProseMirror paste as usual. */
export function createPasteTitlePlugin(ctx: LinkContext, state: PasteTitleState): Plugin {
  return new Plugin({
    key: new PluginKey('hyperlinkPasteTitle'),
    props: {
      handleDOMEvents: {
        paste: (view, event) => {
          state.armed = null
          const text = event.clipboardData?.getData('text/plain').trim() ?? ''
          const match = view.state.selection.empty ? oneUrl(text) : null
          // The same call as the paste rule, so an HTML link the host's gates refuse starts nothing.
          const [decision] = match ? ctx.urls.forWrite({ kind: 'match', match }) : []
          if (decision) state.armed = { text, href: decision.href, plain: false }
          return false
        }
      },
      // ProseMirror passes `inCode || plainText`. Shift sets `plainText`, and a code block
      // makes no link, so either way the paste keeps its URL.
      transformPastedText: (text, plain) => {
        if (plain && state.armed) state.armed.plain = true
        return text
      }
    }
  })
}

/** Call from `onTransaction` only when a paste is armed or a run is pending. */
export function trackPasteTitle(
  ctx: LinkContext,
  options: PasteTitleOptions,
  state: PasteTitleState,
  transaction: Transaction,
  appendedTransactions: Transaction[]
): void {
  const transactions = [transaction, ...appendedTransactions]
  if (transactions.some((tr) => tr.docChanged)) {
    for (const run of [...state.runs]) {
      run.anchor = mapAnchor(ctx.editor, run.anchor, transactions)
      if (!linkRange(ctx, run)) endRun(state, run)
    }
  }
  // The first transaction after the DOM event decides. A paste another plugin took over starts nothing.
  const { armed } = state
  state.armed = null
  if (armed && !armed.plain && transaction.getMeta('uiEvent') === 'paste') {
    startRun(ctx, options, state, armed, transactions)
  }
}

export function endPasteTitleRuns(state: PasteTitleState): void {
  state.armed = null
  for (const run of [...state.runs]) endRun(state, run)
}

function endRun(state: PasteTitleState, run: Run): void {
  clearTimeout(run.deadline)
  run.controller.abort()
  state.runs.delete(run)
}

export function oneUrl(text: string): ReturnType<typeof find>[number] | null {
  // A link match never holds whitespace, so skip the linkify scan of a long multi-word paste.
  if (!text || /\s/.test(text)) return null
  const links = find(text)
  return links.length === 1 && links[0].type === 'url' && links[0].value === text ? links[0] : null
}

// Under collaboration, a remote transaction resolves the anchor against the final state
// and returns no `mapResult`. Mapping it through later transactions would shift it twice.
function mapAnchor(
  editor: Editor,
  anchor: MappablePosition,
  transactions: Transaction[]
): MappablePosition {
  for (const tr of transactions) {
    if (!tr.docChanged) continue
    const updated = editor.utils.getUpdatedPosition(anchor, tr)
    anchor = updated.position
    if (updated.mapResult === null) break
  }
  return anchor
}

function startRun(
  ctx: LinkContext,
  options: PasteTitleOptions,
  state: PasteTitleState,
  armed: Armed,
  transactions: Transaction[]
): void {
  const { editor } = ctx
  const from = findPastedLink(ctx, armed, transactions)
  if (from === null || !hostAllows(options, state, armed.href, editor)) return

  if (state.runs.size >= MAX_RUNS) {
    const [oldest] = state.runs
    endRun(state, oldest)
  }
  const controller = new AbortController()
  const run: Run = {
    text: armed.text,
    href: armed.href,
    anchor: editor.utils.createMappablePosition(from + 1),
    controller,
    deadline: setTimeout(() => endRun(state, run), DEADLINE_MS)
  }
  state.runs.add(run)

  let answer: Promise<string | null>
  try {
    answer = options.fetchTitle({ href: run.href, editor, signal: controller.signal })
  } catch {
    endRun(state, run)
    return
  }
  // A throw or rejection keeps the URL and logs nothing, so an abort is never an error.
  Promise.resolve(answer).then(
    (title) => acceptAnswer(ctx, state, run, title),
    () => endRun(state, run)
  )
}

/** The start of the link the paste made, with the armed href and text, or `null`. */
function findPastedLink(
  ctx: LinkContext,
  armed: Armed,
  transactions: Transaction[]
): number | null {
  const { doc } = ctx.editor.state
  const transform = combineTransactionSteps(transactions[0].before, transactions)
  let from: number | null = null
  for (const { newRange } of getChangedRanges(transform)) {
    doc.nodesBetween(newRange.from, newRange.to, (node, pos) => {
      if (from !== null) return false
      if (!node.isText || !node.marks.some((m) => m.type === ctx.type)) return
      const range = getMarkRange(doc.resolve(pos), ctx.type, { href: armed.href })
      if (range && doc.textBetween(range.from, range.to) === armed.text) from = range.from
    })
    if (from !== null) return from
  }
  return null
}

function hostAllows(
  options: PasteTitleOptions,
  state: PasteTitleState,
  href: string,
  editor: Editor
): boolean {
  if (!options.shouldFetch) return true
  try {
    return options.shouldFetch({ href, editor })
  } catch (e) {
    if (!state.warnedShouldFetch) logger.error('pasteTitle.shouldFetch threw; the URL stays', e)
    state.warnedShouldFetch = true
    return false
  }
}

function acceptAnswer(ctx: LinkContext, state: PasteTitleState, run: Run, answer: unknown): void {
  if (typeof answer !== 'string') {
    if (answer !== null && !state.warnedAnswer) {
      logger.error('pasteTitle.fetchTitle must answer a string or null; the URL stays', answer)
      state.warnedAnswer = true
    }
    endRun(state, run)
    return
  }
  const title = cleanTitle(answer, { text: run.text, href: run.href })
  if (title) swapWhenReady(ctx, state, run, title)
  else endRun(state, run)
}

function swapWhenReady(ctx: LinkContext, state: PasteTitleState, run: Run, title: string): void {
  const { editor } = ctx
  // A late answer, or a retry after `compositionend`, may find the run already ended.
  if (!state.runs.has(run)) return
  if (editor.isDestroyed || !editor.isEditable) {
    endRun(state, run)
    return
  }
  if (editor.view.composing) {
    // ProseMirror reads the composed text in a microtask after `compositionend`, so wait one more.
    // The signal removes the listener when the run ends; the deadline still applies.
    editor.view.dom.addEventListener(
      'compositionend',
      () => queueMicrotask(() => swapWhenReady(ctx, state, run, title)),
      { once: true, signal: run.controller.signal }
    )
    return
  }
  const range = linkRange(ctx, run)
  const { from, to } = editor.state.selection
  // A caret inside the link would jump to its end.
  if (!range || isInside(from, range) || isInside(to, range)) {
    endRun(state, run)
    return
  }
  // End first, so the swap's own transaction does not check this run.
  endRun(state, run)
  dispatchSwap(editor, range, title)
}

// Undo then goes title (and later typing) → title → URL → nothing, in prosemirror-history and y-undo.
// Never `addToHistory: false`: under Yjs it makes the paste impossible to undo.
export function dispatchSwap(editor: Editor, range: Range, title: string): void {
  const { state, view } = editor
  const marks = state.doc.nodeAt(range.from)?.marks ?? []
  const tr = state.tr
    .replaceWith(range.from, range.to, state.schema.text(title, marks))
    .setMeta(PREVENT_AUTOLINK_META, true)
    .setMeta(INPUT_RULE_META, true)
    .setMeta(PASTE_TITLE_META, true)
  view.dispatch(closeHistory(tr))
  view.dispatch(closeHistory(editor.state.tr).setMeta(INPUT_RULE_META, true))
}

function linkRange(ctx: LinkContext, run: Run): Range | null {
  const { doc } = ctx.editor.state
  const pos = run.anchor.position
  if (pos < 0 || pos > doc.content.size) return null
  const range = getMarkRange(doc.resolve(pos), ctx.type, { href: run.href })
  return range && doc.textBetween(range.from, range.to) === run.text ? range : null
}

const isInside = (pos: number, range: Range): boolean => pos > range.from && pos < range.to
