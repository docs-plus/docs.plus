import { useState, useEffect, useCallback, useRef } from 'react'
import { useStore } from '@stores'
import type { TocHeading } from '../types'
import { TIPTAP_NODES } from '@types'

// Debounce delay for document changes (ms)
const DEBOUNCE_DELAY = 150

/**
 * Hook to get TOC items from the editor.
 * Extracts structural depth (nesting level) rather than the heading's level attribute,
 * since docsy uses nested heading structure where headings can contain other headings.
 *
 * Performance optimizations:
 * - Debounced updates to avoid re-scanning on every keystroke
 * - Single pass extraction with depth tracking
 * - Shallow comparison to avoid unnecessary re-renders
 */
const useTocItems = () => {
  const [items, setItems] = useState<TocHeading[]>([])
  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  // Refs for debouncing and tracking
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastItemsRef = useRef<string>('') // JSON string for comparison

  const extractHeadings = useCallback(() => {
    if (!editor) return

    const headings: TocHeading[] = []
    const doc = editor.state.doc

    // Track depth during traversal instead of resolving each position
    let currentDepth = 0
    const depthStack: string[] = []

    doc.descendants((node, pos, parent) => {
      // Track entering/exiting heading nodes for depth
      if (node.type.name === TIPTAP_NODES.HEADING_TYPE) {
        currentDepth++
        depthStack.push(node.attrs.id)
      }

      if (node.type.name === TIPTAP_NODES.CONTENT_HEADING_TYPE) {
        const headingId = parent?.attrs?.id || node.attrs.id
        const text = node.textContent

        if (text && headingId) {
          headings.push({
            id: headingId,
            level: currentDepth || 1,
            text
          })
        }
      }
    })

    // Shallow comparison to avoid unnecessary re-renders
    const newItemsJson = JSON.stringify(headings.map((h) => `${h.id}:${h.level}:${h.text}`))
    if (newItemsJson !== lastItemsRef.current) {
      lastItemsRef.current = newItemsJson
      setItems(headings)
    }
  }, [editor])

  // Debounced extraction
  const debouncedExtract = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(extractHeadings, DEBOUNCE_DELAY)
  }, [extractHeadings])

  useEffect(() => {
    if (!editor) return

    // Initial extraction (immediate)
    extractHeadings()

    // Listen for updates with debouncing
    const handleTransaction = ({ transaction }: any) => {
      // Only update for meaningful changes
      const shouldUpdate =
        transaction.docChanged ||
        transaction.meta?.foldAndunfold ||
        transaction.meta?.renderTOC ||
        transaction.meta?.paste ||
        transaction.meta?.newHeadingCreated

      if (shouldUpdate) {
        // Immediate update for structural changes, debounced for typing
        if (transaction.meta?.renderTOC || transaction.meta?.newHeadingCreated) {
          extractHeadings()
        } else {
          debouncedExtract()
        }
      }
    }

    editor.on('transaction', handleTransaction)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      editor.off('transaction', handleTransaction)
    }
  }, [editor, extractHeadings, debouncedExtract])

  return items
}

export default useTocItems
