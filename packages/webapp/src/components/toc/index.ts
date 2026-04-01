// Components
export { TocContextMenu } from './TocContextMenu'
export { TocDesktop } from './TocDesktop'
export { TocHeader } from './TocHeader'
export { TocItemDesktop } from './TocItemDesktop'
export { TocItemMobile } from './TocItemMobile'
export { TocMobile } from './TocMobile'

// Hooks
export {
  useActiveHeading,
  useFocusedHeadingStore,
  useHeadingScrollSpy,
  usePresentUsers,
  useToc,
  useTocActions,
  useTocAutoScroll,
  useTocDrag,
  useUnreadCount
} from './hooks'

// Utils
export { TOC_CLASSES, type TocClassName } from './tocClasses'
export type { NestedTocNode } from './utils'
export { buildNestedToc, scrollToDocTitle, scrollToHeading } from './utils'

// Types (re-export from @types)
export type { TocContextMenuState, TocItem as TocItemType } from '@types'
