import { headingFoldPluginKey } from '@components/TipTap/extensions/heading-fold'
import { useStore } from '@stores'
import type { Transaction } from '@tiptap/pm/state'
import type { TocItem } from '@types'
import { TIPTAP_NODES, TRANSACTION_META } from '@types'
import throttle from 'lodash/throttle'
import { useCallback, useEffect, useRef, useState } from 'react'

type HeadingFoldSlice = ReturnType<typeof headingFoldPluginKey.getState>

type FoldSnapshot = {
  foldedIds: Set<string>
  animating: Map<string, 'folding' | 'unfolding'>
}

/** Clone fold state for diffing — `transaction.before` is the pre-tx doc (Node), not EditorState. */
function snapshotFoldState(state: HeadingFoldSlice): FoldSnapshot {
  return {
    foldedIds: new Set(state?.foldedIds ?? []),
    animating: new Map(state?.animating ?? [])
  }
}

function foldSnapshotsEqual(a: FoldSnapshot, b: FoldSnapshot): boolean {
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

function isHeadingRelatedChange(transaction: Transaction): boolean {
  if (transaction.getMeta(headingFoldPluginKey)) return false

  if (
    transaction.getMeta(TRANSACTION_META.RENDER_TOC) ||
    transaction.getMeta(TRANSACTION_META.PASTE) ||
    transaction.getMeta(TRANSACTION_META.NEW_HEADING_CREATED) ||
    transaction.getMeta(TRANSACTION_META.HEADING_DELETED) ||
    transaction.getMeta(TRANSACTION_META.HEADING_TEXT_CHANGED)
  ) {
    return true
  }

  if (!transaction.docChanged) return false

  let affectsHeadings = false
  transaction.steps.forEach((step) => {
    const stepMap = step.getMap()
    stepMap.forEach((oldStart, oldEnd, newStart, newEnd) => {
      const clampedOldEnd = Math.min(oldEnd, transaction.before.content.size)
      const clampedOldStart = Math.min(oldStart, clampedOldEnd)
      const clampedNewEnd = Math.min(newEnd, transaction.doc.content.size)
      const clampedNewStart = Math.min(newStart, clampedNewEnd)

      if (clampedOldStart < clampedOldEnd) {
        transaction.before.nodesBetween(clampedOldStart, clampedOldEnd, (node) => {
          if (node.type.name === TIPTAP_NODES.HEADING_TYPE) {
            affectsHeadings = true
            return false
          }
        })
      }
      if (!affectsHeadings && clampedNewStart < clampedNewEnd) {
        transaction.doc.nodesBetween(clampedNewStart, clampedNewEnd, (node) => {
          if (node.type.name === TIPTAP_NODES.HEADING_TYPE) {
            affectsHeadings = true
            return false
          }
        })
      }
    })
  })

  return affectsHeadings
}

export function useToc() {
  const [items, setItems] = useState<TocItem[]>([])

  const editor = useStore((state) => state.settings.editor.instance)

  const foldSnapshotRef = useRef<FoldSnapshot>(snapshotFoldState(undefined))

  const buildTocItems = useCallback(() => {
    if (!editor || editor.isDestroyed) return

    const headings: TocItem[] = []
    const doc = editor.state.doc

    const foldState = headingFoldPluginKey.getState(editor.state)
    const foldedIds = foldState?.foldedIds ?? new Set<string>()
    const animating = foldState?.animating ?? new Map<string, 'folding' | 'unfolding'>()

    let offset = 0
    for (let i = 0; i < doc.content.childCount; i++) {
      const node = doc.content.child(i)
      const pos = offset
      offset += node.nodeSize

      if (node.type.name !== TIPTAP_NODES.HEADING_TYPE) continue

      const headingId = node.attrs['toc-id'] as string
      if (!headingId || !node.textContent) continue

      const isOpen = !foldedIds.has(headingId) || animating.get(headingId) === 'unfolding'

      let dom: HTMLHeadingElement | null = null
      try {
        const domPos = editor.view.domAtPos(pos + 1)
        dom = domPos.node as HTMLHeadingElement
      } catch {
        // DOM might not be ready
      }

      headings.push({
        id: headingId,
        level: node.attrs.level as number,
        originalLevel: node.attrs.level as number,
        textContent: node.textContent,
        pos,
        open: isOpen,
        isActive: false,
        isScrolledOver: false,
        itemIndex: headings.length,
        node,
        editor,
        dom: dom as HTMLHeadingElement
      })
    }

    setItems(headings)
    foldSnapshotRef.current = snapshotFoldState(headingFoldPluginKey.getState(editor.state))
  }, [editor])

  const toggleSection = useCallback(
    (id: string) => {
      if (!editor) return
      editor.commands.toggleFold(id)
    },
    [editor]
  )

  useEffect(() => {
    if (!editor) return

    foldSnapshotRef.current = snapshotFoldState(headingFoldPluginKey.getState(editor.state))

    const HEADING_REBUILD_THROTTLE_MS = 100
    const throttledHeadingRebuild = throttle(() => buildTocItems(), HEADING_REBUILD_THROTTLE_MS, {
      leading: true,
      trailing: true
    })

    const handleTransaction = ({ transaction }: { transaction: Transaction }) => {
      const nextSnap = snapshotFoldState(headingFoldPluginKey.getState(editor.state))
      if (!foldSnapshotsEqual(foldSnapshotRef.current, nextSnap)) {
        throttledHeadingRebuild.cancel()
        buildTocItems()
        return
      }

      if (!isHeadingRelatedChange(transaction)) return
      throttledHeadingRebuild()
    }

    editor.on('transaction', handleTransaction)

    const initTimer = setTimeout(buildTocItems, 200)

    return () => {
      editor.off('transaction', handleTransaction)
      throttledHeadingRebuild.cancel()
      clearTimeout(initTimer)
    }
  }, [editor, buildTocItems])

  return { items, toggleSection }
}
