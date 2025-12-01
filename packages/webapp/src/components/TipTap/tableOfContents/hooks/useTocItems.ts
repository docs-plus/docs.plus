import { useState, useEffect, useCallback } from 'react'
import { useStore } from '@stores'

export type TocAnchor = {
  id: string
  level: number
  textContent: string
  pos: number
  open: boolean
  isActive: boolean
}

/**
 * Hook that provides TOC items from the TipTap TableOfContents extension.
 * Uses custom scroll tracking because the extension's isActive doesn't work
 * correctly with contentHeading nodes.
 */
const useTocItems = () => {
  const [items, setItems] = useState<TocAnchor[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  // Simple scroll tracking + auto-scroll TOC to active item
  useEffect(() => {
    const wrapper = document.querySelector('.editorWrapper')
    if (!wrapper) return

    const onScroll = () => {
      const headings = wrapper.querySelectorAll('.heading[data-id]')
      let active: Element | null = null

      for (const h of headings) {
        const top = h.getBoundingClientRect().top - wrapper.getBoundingClientRect().top
        if (top <= 100) active = h
        else break
      }

      if (!active && headings.length) active = headings[0]
      const newActiveId = active?.getAttribute('data-id') || null

      // Auto-scroll TOC panel to show active item with margin
      if (newActiveId && newActiveId !== activeId) {
        const tocItem = document.querySelector(
          `.toc__list .toc__item[data-id="${newActiveId}"]`
        ) as HTMLElement
        const tocWrapper = tocItem?.closest('.tiptap__toc') as HTMLElement

        if (tocItem && tocWrapper) {
          const itemRect = tocItem.getBoundingClientRect()
          const wrapperRect = tocWrapper.getBoundingClientRect()
          const margin = 80

          if (itemRect.bottom > wrapperRect.bottom - margin) {
            tocWrapper.scrollBy({
              top: itemRect.bottom - wrapperRect.bottom + margin,
              behavior: 'smooth'
            })
          } else if (itemRect.top < wrapperRect.top + margin) {
            tocWrapper.scrollBy({
              top: itemRect.top - wrapperRect.top - margin,
              behavior: 'smooth'
            })
          }
        }
      }

      setActiveId(newActiveId)
    }

    onScroll()
    wrapper.addEventListener('scroll', onScroll, { passive: true })
    return () => wrapper.removeEventListener('scroll', onScroll)
  }, [items.length, activeId])

  // Process TOC data from extension
  const handleUpdate = useCallback(
    (anchors: any[]) => {
      const domHeadings = document.querySelectorAll('.heading[data-id]')
      const idMap = new Map<string, string>()

      domHeadings.forEach((h) => {
        const text = h.querySelector('.title')?.textContent?.trim() || ''
        const id = h.getAttribute('data-id') || ''
        if (text && id) idMap.set(text, id)
      })

      setItems(
        anchors.map((a) => {
          const id = idMap.get(a.textContent?.trim()) || a.id
          return {
            id,
            level: a.level,
            textContent: a.textContent,
            pos: a.pos,
            isActive: id === activeId,
            open: !document
              .querySelector(`.toc__item[data-id="${id}"]`)
              ?.classList.contains('closed')
          }
        })
      )
    },
    [activeId]
  )

  // Listen for extension updates
  useEffect(() => {
    if (!editor) return

    const handler = (e: CustomEvent) => handleUpdate(e.detail)
    window.addEventListener('toc-update', handler as EventListener)

    if (editor.storage.tableOfContents?.content) {
      handleUpdate(editor.storage.tableOfContents.content)
    }

    return () => window.removeEventListener('toc-update', handler as EventListener)
  }, [editor, handleUpdate])

  return { items, editor }
}

export default useTocItems
