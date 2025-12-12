import { useState, useCallback, useEffect, useRef } from 'react'
import { useStore } from '@stores'
import { TIPTAP_NODES, TIPTAP_EVENTS, TRANSACTION_META } from '@types'
import type { TocItem } from '@types'
import type { Transaction } from '@tiptap/pm/state'
import PubSub from 'pubsub-js'
import { getNodeState } from '@components/TipTap/extentions/helper'

/**
 * Gets the offset top of an element recursively
 */
function getOffsetTop(element: HTMLElement | null): number {
  return element ? element.offsetTop + getOffsetTop(element.offsetParent as HTMLElement) : 0
}

/**
 * Checks if a transaction contains changes that affect headings
 * This is more efficient than rebuilding on every docChanged
 */
function isHeadingRelatedChange(transaction: Transaction): boolean {
  // Skip FOLD_AND_UNFOLD transactions - these are handled by PubSub with longer delay
  // to wait for the CSS animation to complete and the DOM to update
  if (transaction.getMeta(TRANSACTION_META.FOLD_AND_UNFOLD)) {
    return false
  }

  // Check transaction metadata for explicit TOC-related events
  if (
    transaction.getMeta(TRANSACTION_META.RENDER_TOC) ||
    transaction.getMeta(TRANSACTION_META.PASTE) ||
    transaction.getMeta(TRANSACTION_META.NEW_HEADING_CREATED) ||
    transaction.getMeta(TRANSACTION_META.HEADING_LEVEL_CHANGED) ||
    transaction.getMeta(TRANSACTION_META.HEADING_DELETED) ||
    transaction.getMeta(TRANSACTION_META.HEADING_TEXT_CHANGED)
  ) {
    return true
  }

  // If doc didn't change, no need to check further
  if (!transaction.docChanged) return false

  // Check if any step affects heading-related nodes
  let affectsHeadings = false
  transaction.steps.forEach((step) => {
    const stepMap = step.getMap()
    stepMap.forEach((oldStart, oldEnd, newStart, newEnd) => {
      // Check old doc for affected headings
      transaction.before.nodesBetween(oldStart, oldEnd, (node) => {
        if (
          node.type.name === TIPTAP_NODES.HEADING_TYPE ||
          node.type.name === TIPTAP_NODES.CONTENT_HEADING_TYPE
        ) {
          affectsHeadings = true
          return false // Stop iteration
        }
      })
      // Check new doc for affected headings
      if (!affectsHeadings) {
        transaction.doc.nodesBetween(newStart, newEnd, (node) => {
          if (
            node.type.name === TIPTAP_NODES.HEADING_TYPE ||
            node.type.name === TIPTAP_NODES.CONTENT_HEADING_TYPE
          ) {
            affectsHeadings = true
            return false // Stop iteration
          }
        })
      }
    })
  })

  return affectsHeadings
}

/**
 * Main hook for TOC state and items.
 * Traverses the document to build TOC items and manages fold/unfold state.
 * Uses getNodeState (localStorage/IndexedDB) as source of truth for fold state.
 * This is the same source the Heading node uses, ensuring consistency.
 *
 * Performance optimizations:
 * - Only rebuilds when heading-related changes occur
 * - Debounces rapid updates
 * - Uses refs to avoid unnecessary re-renders
 * - Cleans up subscriptions on unmount
 */
export function useToc() {
  const [items, setItems] = useState<TocItem[]>([])
  const pubsubTokenRef = useRef<string | null>(null)

  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  const buildTocItems = useCallback(() => {
    if (!editor || editor.isDestroyed) return

    const headings: TocItem[] = []
    const doc = editor.state.doc

    doc.descendants((node, pos, parent) => {
      if (node.type.name !== TIPTAP_NODES.CONTENT_HEADING_TYPE) return

      const headingId = parent?.attrs?.id || node.attrs?.id
      if (!headingId || !node.textContent) return

      const headingSection = document.querySelector(`.heading[data-id="${headingId}"]`)
      const offsetTop = headingSection ? getOffsetTop(headingSection as HTMLElement) : 0

      // Use getNodeState as source of truth - same source as the Heading node
      // This reads from localStorage/IndexedDB which is updated when fold state changes
      const nodeState = getNodeState(headingId)
      const isOpen = nodeState.crinkleOpen

      let dom: HTMLHeadingElement | null = null
      try {
        const domPos = editor.view.domAtPos(pos + 1)
        dom = domPos.node as HTMLHeadingElement
      } catch {
        // DOM might not be ready
      }

      headings.push({
        id: headingId,
        level: node.attrs.level,
        originalLevel: node.attrs.level,
        textContent: node.textContent,
        pos,
        open: isOpen,
        isActive: false,
        isScrolledOver: false,
        itemIndex: headings.length,
        offsetTop,
        node,
        editor,
        dom: dom as HTMLHeadingElement
      })
    })

    setItems(headings)
  }, [editor])

  const toggleSection = useCallback(
    (id: string) => {
      const currentItem = items.find((item) => item.id === id)
      const isCurrentlyOpen = currentItem?.open ?? true

      // Optimistic update: toggle immediately for responsive UI
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, open: !isCurrentlyOpen } : item))
      )

      // Trigger editor fold/unfold (crinkle) - editor DOM will be updated
      PubSub.publish(TIPTAP_EVENTS.FOLD_AND_UNFOLD, {
        headingId: id,
        open: !isCurrentlyOpen
      })
    },
    [items]
  )

  useEffect(() => {
    if (!editor) return

    let debounceTimer: ReturnType<typeof setTimeout>
    let lastUpdateTime = 0
    const MIN_UPDATE_INTERVAL = 100 // Minimum ms between updates

    const handleTransaction = ({ transaction }: { transaction: Transaction }) => {
      // Skip if transaction doesn't affect headings
      if (!isHeadingRelatedChange(transaction)) return

      // Throttle updates
      const now = Date.now()
      const timeSinceLastUpdate = now - lastUpdateTime

      clearTimeout(debounceTimer)

      if (timeSinceLastUpdate < MIN_UPDATE_INTERVAL) {
        // Debounce if updates are too frequent
        debounceTimer = setTimeout(() => {
          lastUpdateTime = Date.now()
          buildTocItems()
        }, MIN_UPDATE_INTERVAL - timeSinceLastUpdate)
      } else {
        // Allow immediate update with small delay for DOM sync
        debounceTimer = setTimeout(() => {
          lastUpdateTime = Date.now()
          buildTocItems()
        }, 50)
      }
    }

    // Subscribe to fold/unfold events - rebuild after IndexedDB update completes
    // We read from localStorage/IndexedDB (same source as node) so we don't need
    // to wait for CSS animation. Small delay for DB operation to complete.
    pubsubTokenRef.current = PubSub.subscribe(
      TIPTAP_EVENTS.FOLD_AND_UNFOLD,
      (_msg: string, _data: any) => {
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(buildTocItems, 100)
      }
    )

    editor.on('transaction', handleTransaction)

    // Initial build
    const initTimer = setTimeout(buildTocItems, 200)

    return () => {
      editor.off('transaction', handleTransaction)
      clearTimeout(debounceTimer)
      clearTimeout(initTimer)
      // Cleanup PubSub subscription
      if (pubsubTokenRef.current) {
        PubSub.unsubscribe(pubsubTokenRef.current)
        pubsubTokenRef.current = null
      }
    }
  }, [editor, buildTocItems])

  return { items, toggleSection }
}
