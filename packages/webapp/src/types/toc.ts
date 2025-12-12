import type { Editor } from '@tiptap/react'
import type { ProseMirrorNode as Node } from '@types'

/**
 * TOC item representing a heading in the document
 */
export interface TocItem {
  id: string
  level: number
  originalLevel: number
  textContent: string
  pos: number
  open: boolean
  isActive: boolean
  isScrolledOver: boolean
  itemIndex: number
  offsetTop: number
  node: Node
  editor: Editor
  dom: HTMLHeadingElement
}

/**
 * Props for TOC item components
 */
export interface TocItemProps {
  item: TocItem
  children?: TocItem[]
  variant: 'desktop' | 'mobile'
  onClose?: () => void
}

/**
 * Props for TOC list components
 */
export interface TocListProps {
  items: TocItem[]
  variant: 'desktop' | 'mobile'
  onClose?: () => void
}

/**
 * Context menu state for TOC
 */
export interface TocContextMenuState {
  headingId: string | null
  isOpen: boolean
}
