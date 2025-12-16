// Components
export { TocDesktop } from './TocDesktop'
export { TocMobile } from './TocMobile'
export { TocHeader } from './TocHeader'
export { TocItem } from './TocItem'
export { TocContextMenu } from './TocContextMenu'

// Hooks
export {
  useToc,
  useTocActions,
  useTocDrag,
  useActiveHeading,
  usePresentUsers,
  useUnreadCount,
  useHeadingScrollSpy,
  useTocAutoScroll,
  useFocusedHeadingStore
} from './hooks'

// Utils
export { scrollToHeading, scrollToDocTitle, buildNestedToc } from './utils'

// Types (re-export from @types)
export type {
  TocItem as TocItemType,
  TocItemProps,
  TocListProps,
  TocContextMenuState
} from '@types'
