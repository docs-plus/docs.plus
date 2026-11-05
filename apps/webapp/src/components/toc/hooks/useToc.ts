import { headingFoldPluginKey } from '@components/TipTap/extensions/heading-fold'
import { useStore } from '@stores'
import type { Transaction } from '@tiptap/pm/state'
import type { TocItem } from '@types'
import throttle from 'lodash/throttle'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'

import { buildNestedToc, type NestedTocNode } from '../utils/buildNestedToc'
import { transactionRequiresTocRebuild } from '../utils/headingTransaction'
import { outlineOf } from '../utils/outline'

type HeadingFoldSlice = ReturnType<typeof headingFoldPluginKey.getState>

type FoldSnapshot = {
  foldedIds: Set<string>
  animating: Map<string, 'folding' | 'unfolding'>
}

const NO_FOLDS: FoldSnapshot = { foldedIds: new Set(), animating: new Map() }

// The fold plugin copies its Set and Map on write, so references are a safe snapshot.
function snapshotFoldState(state: HeadingFoldSlice): FoldSnapshot {
  return state ? { foldedIds: state.foldedIds, animating: state.animating } : NO_FOLDS
}

const sameItem = (a: TocItem | undefined, b: TocItem) =>
  a !== undefined &&
  a.id === b.id &&
  a.level === b.level &&
  a.textContent === b.textContent &&
  a.open === b.open &&
  a.isTitle === b.isTitle

/** Reuse each unchanged row object, so memoized rows skip a render on an unrelated edit. */
function reuseItems(prev: TocItem[], next: TocItem[]): TocItem[] {
  const byId = new Map(prev.map((item) => [item.id, item]))
  let changed = prev.length !== next.length
  const merged = next.map((item, i) => {
    const old = byId.get(item.id)
    if (!sameItem(old, item)) {
      changed = true
      return item
    }
    if (prev[i] !== old) changed = true
    return old as TocItem
  })
  return changed ? merged : prev
}

function foldSnapshotsEqual(a: FoldSnapshot, b: FoldSnapshot): boolean {
  if (a.foldedIds === b.foldedIds && a.animating === b.animating) return true
  if (a.foldedIds.size !== b.foldedIds.size) return false
  for (const id of a.foldedIds) {
    if (!b.foldedIds.has(id)) return false
  }
  if (a.animating.size !== b.animating.size) return false
  for (const [k, v] of a.animating) {
    if (b.animating.get(k) !== v) return false
  }
  return true
}

type TocState = { items: TocItem[]; nested: NestedTocNode<TocItem>[] }
const EMPTY_TOC: TocState = { items: [], nested: [] }

export function useToc() {
  const [{ items, nested }, setToc] = useState<TocState>(EMPTY_TOC)

  const editor = useStore((state) => state.settings.editor.instance)

  const foldSnapshotRef = useRef<FoldSnapshot>(snapshotFoldState(undefined))

  const buildTocItems = useCallback(() => {
    if (!editor || editor.isDestroyed) return

    const foldState = headingFoldPluginKey.getState(editor.state)
    const foldedIds = foldState?.foldedIds ?? new Set<string>()
    const animating = foldState?.animating ?? new Map<string, 'folding' | 'unfolding'>()

    // An empty heading keeps its row, so the rows match the outline the move planner reads.
    const headings: TocItem[] = outlineOf(editor.state.doc).map((node) => ({
      id: node.id,
      level: node.level,
      textContent: node.text,
      open: !foldedIds.has(node.id) || animating.get(node.id) === 'unfolding',
      isTitle: node.isTitle
    }))

    setToc((prev) => {
      const next = reuseItems(prev.items, headings)
      return next === prev.items ? prev : { items: next, nested: buildNestedToc(next, prev.nested) }
    })
    foldSnapshotRef.current = snapshotFoldState(headingFoldPluginKey.getState(editor.state))
  }, [editor])

  const toggleSection = useCallback(
    (id: string) => {
      if (!editor) return
      editor.commands.toggleFold(id)
    },
    [editor]
  )

  useLayoutEffect(() => {
    if (!editor || editor.isDestroyed) {
      setToc(EMPTY_TOC)
      return
    }

    foldSnapshotRef.current = snapshotFoldState(headingFoldPluginKey.getState(editor.state))

    const HEADING_REBUILD_THROTTLE_MS = 100
    const throttledHeadingRebuild = throttle(() => buildTocItems(), HEADING_REBUILD_THROTTLE_MS, {
      leading: true,
      trailing: true
    })

    const handleTransaction = ({ transaction }: { transaction: Transaction }) => {
      const foldMeta = transaction.getMeta(headingFoldPluginKey)
      if (!transaction.docChanged && !foldMeta) return

      const nextSnap = snapshotFoldState(headingFoldPluginKey.getState(editor.state))
      if (!foldSnapshotsEqual(foldSnapshotRef.current, nextSnap)) {
        throttledHeadingRebuild.cancel()
        buildTocItems()
        return
      }

      if (!transactionRequiresTocRebuild(transaction)) return
      throttledHeadingRebuild()
    }

    editor.on('transaction', handleTransaction)
    buildTocItems()
    const initTimer = setTimeout(buildTocItems, 200)

    return () => {
      editor.off('transaction', handleTransaction)
      throttledHeadingRebuild.cancel()
      clearTimeout(initTimer)
    }
  }, [editor, buildTocItems])

  return { items, nested, toggleSection }
}
