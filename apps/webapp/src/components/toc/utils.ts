import { CHAT_OPEN } from '@services/eventsHub'
import type { Editor } from '@tiptap/react'
import { TIPTAP_NODES } from '@types'
import { scrollElementInMobilePadEditor } from '@utils/scrollMobilePadEditor'
import PubSub from 'pubsub-js'
import slugify from 'slugify'

/**
 * Scrolls the editor to a specific heading and updates the URL.
 * Builds a breadcrumb path by walking preceding headings (flat schema).
 */
export function scrollToHeading(
  editor: Editor,
  headingId: string,
  options: { openChatRoom?: boolean; updateUrl?: boolean } = {}
) {
  const { openChatRoom = false, updateUrl = true } = options

  const targetHeading = document.querySelector(`[data-toc-id="${headingId}"]`)
  if (!targetHeading) return

  if (updateUrl) {
    const doc = editor.state.doc
    const breadcrumb: string[] = []

    for (let i = 0; i < doc.content.childCount; i++) {
      const child = doc.content.child(i)

      if (child.type.name !== TIPTAP_NODES.HEADING_TYPE) continue

      breadcrumb.push(slugify(child.textContent?.toLowerCase()?.trim() || ''))

      if ((child.attrs['toc-id'] as string) === headingId) break
    }

    const url = new URL(window.location.href)
    url.searchParams.set('h', breadcrumb.join('>'))
    url.searchParams.set('id', headingId)
    window.history.replaceState({}, '', url)
  }

  if (!scrollElementInMobilePadEditor(targetHeading, { behavior: 'smooth', block: 'start' })) {
    targetHeading.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (openChatRoom) {
    PubSub.publish(CHAT_OPEN, { headingId })
  }
}

export function scrollToDocTitle(options: {
  workspaceId?: string
  title: string
  openChatRoom?: boolean
}) {
  const { workspaceId, title, openChatRoom = false } = options

  const docTitleHeading = document.querySelector('.tiptap__editor.docy_editor h1')
  if (
    docTitleHeading &&
    !scrollElementInMobilePadEditor(docTitleHeading, { behavior: 'smooth', block: 'start' })
  ) {
    docTitleHeading.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (!workspaceId) return

  const url = new URL(window.location.href)
  url.searchParams.set('h', slugify(title.toLowerCase().trim()))
  url.searchParams.set('id', workspaceId)
  window.history.replaceState({}, '', url)

  if (openChatRoom) {
    PubSub.publish(CHAT_OPEN, { headingId: workspaceId })
  }
}

/** One TOC row and its subtree (built once at the root). */
export type NestedTocNode<T extends { level: number }> = {
  item: T
  nodes: NestedTocNode<T>[]
}

// AvatarStack `sm`: 32px face width (Tailwind size-8) with 12px overlap
// per extra face (`-space-x-3` in AvatarStack.tsx) → 20px stride. Chat slot
// width is digit-driven so the unread badge never overlaps the avatars.
// Layout insets/gutter: `--toc-*` on `.tiptap__toc` in `_tableOfContents.scss`.
const TOC_TRAIL_GAP_PX = 6
const AVATAR_SM_FACE_PX = 32
const AVATAR_SM_STRIDE_PX = 20
const AVATAR_OVERFLOW_BADGE_PX = 24
const CHAT_SLOT_BASE_PX = 28
const CHAT_SLOT_1_DIGIT_PX = 32
const CHAT_SLOT_2_DIGIT_PX = 36
const CHAT_SLOT_OVERFLOW_PX = 44

export const TOC_TRAIL_MAX_AVATARS = 3

function tocPresenceReservePx(userCount: number): number {
  if (userCount <= 0) return 0
  const visible = Math.min(userCount, TOC_TRAIL_MAX_AVATARS)
  const stack = AVATAR_SM_FACE_PX + Math.max(0, visible - 1) * AVATAR_SM_STRIDE_PX
  return stack + (userCount > TOC_TRAIL_MAX_AVATARS ? AVATAR_OVERFLOW_BADGE_PX : 0)
}

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

  for (let i = 0; i < items.length; ) {
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
