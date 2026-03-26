import { headingFoldPluginKey } from '@components/TipTap/extensions/heading-fold'
import { useStore } from '@stores'
import type { TocItem } from '@types'
import { TIPTAP_NODES, type Transaction, TRANSACTION_META } from '@types'
import { useCallback, useEffect, useState } from 'react'

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

  const buildTocItems = useCallback(() => {
    if (!editor || editor.isDestroyed) return

    const headings: TocItem[] = []
    const doc = editor.state.doc

    const foldState = headingFoldPluginKey.getState(editor.state)
    const foldedIds = foldState?.foldedIds ?? new Set<string>()

    let offset = 0
    for (let i = 0; i < doc.content.childCount; i++) {
      const node = doc.content.child(i)
      const pos = offset
      offset += node.nodeSize

      if (node.type.name !== TIPTAP_NODES.HEADING_TYPE) continue

      const headingId = node.attrs['toc-id'] as string
      if (!headingId || !node.textContent) continue

      const isOpen = !foldedIds.has(headingId)

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
  }, [editor])

  const toggleSection = useCallback(
    (id: string) => {
      if (!editor) return

      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, open: !item.open } : item))
      )

      editor.commands.toggleFold(id)
    },
    [editor]
  )

  useEffect(() => {
    if (!editor) return

    let debounceTimer: ReturnType<typeof setTimeout>
    let lastUpdateTime = 0
    const MIN_UPDATE_INTERVAL = 100

    const handleTransaction = ({ transaction }: { transaction: Transaction }) => {
      const foldMeta = transaction.getMeta(headingFoldPluginKey)
      if (foldMeta) {
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(buildTocItems, 100)
        return
      }

      if (!isHeadingRelatedChange(transaction)) return

      const now = Date.now()
      const timeSinceLastUpdate = now - lastUpdateTime

      clearTimeout(debounceTimer)

      if (timeSinceLastUpdate < MIN_UPDATE_INTERVAL) {
        debounceTimer = setTimeout(() => {
          lastUpdateTime = Date.now()
          buildTocItems()
        }, MIN_UPDATE_INTERVAL - timeSinceLastUpdate)
      } else {
        debounceTimer = setTimeout(() => {
          lastUpdateTime = Date.now()
          buildTocItems()
        }, 50)
      }
    }

    editor.on('transaction', handleTransaction)

    const initTimer = setTimeout(buildTocItems, 200)

    return () => {
      editor.off('transaction', handleTransaction)
      clearTimeout(debounceTimer)
      clearTimeout(initTimer)
    }
  }, [editor, buildTocItems])

  return { items, toggleSection }
}
