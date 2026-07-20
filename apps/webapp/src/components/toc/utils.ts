import { tocPresenceReservePx } from '@utils/avatarStackGeometry'

/** One TOC row and its subtree (built once at the root). */
export type NestedTocNode<T extends { level: number }> = {
  item: T
  nodes: NestedTocNode<T>[]
}

// Chat slot width is digit-driven so the unread badge never overlaps the avatars.
// Presence stack width: `tocPresenceReservePx` in stackGeometry (sm face/stride).
// Layout insets/gutter: `--toc-*` on `.tiptap__toc` in `_tableOfContents.scss`.
const TOC_TRAIL_GAP_PX = 6
const CHAT_SLOT_BASE_PX = 28
const CHAT_SLOT_1_DIGIT_PX = 32
const CHAT_SLOT_2_DIGIT_PX = 36
const CHAT_SLOT_OVERFLOW_PX = 44

function tocChatSlotPx(unreadCount: number): number {
  if (unreadCount <= 0) return CHAT_SLOT_BASE_PX
  if (unreadCount >= 100) return CHAT_SLOT_OVERFLOW_PX
  if (unreadCount >= 10) return CHAT_SLOT_2_DIGIT_PX
  return CHAT_SLOT_1_DIGIT_PX
}

/** Reserve width so titles clear the trail cluster; chat icon x-position is fixed separately. */
export function tocTrailingRailPx(userCount: number, unreadCount: number): number {
  const chat = tocChatSlotPx(unreadCount)
  const stack = tocPresenceReservePx(userCount)
  return stack > 0 ? chat + TOC_TRAIL_GAP_PX + stack : chat
}

/**
 * Flat heading list → outline tree. O(n) single pass at each level (no repeated nesting per depth).
 */
export function buildNestedToc<T extends { level: number }>(items: T[]): NestedTocNode<T>[] {
  const result: NestedTocNode<T>[] = []

  for (let i = 0; i < items.length;) {
    const item = items[i]
    let j = i + 1
    while (j < items.length && items[j].level > item.level) {
      j++
    }
    const slice = items.slice(i + 1, j)
    result.push({ item, nodes: buildNestedToc(slice) })
    i = j
  }

  return result
}
