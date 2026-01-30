import { CHAT_OPEN } from '@services/eventsHub'
import type { Editor } from '@tiptap/react'
import { TIPTAP_NODES } from '@types'
import PubSub from 'pubsub-js'
import slugify from 'slugify'

/**
 * Scrolls the editor to a specific heading and updates the URL
 */
export function scrollToHeading(
  editor: Editor,
  headingId: string,
  options: { openChatRoom?: boolean; updateUrl?: boolean } = {}
) {
  const { openChatRoom = false, updateUrl = true } = options

  const targetHeading = document.querySelector(`.heading[data-id="${headingId}"]`)
  if (!targetHeading) return

  const posAt = editor.view.posAtDOM(targetHeading, 0)
  if (posAt === -1) return

  // Build heading path for URL
  if (updateUrl) {
    const nodePos = editor.view.state.doc.resolve(posAt)
    // @ts-ignore - path exists on ResolvedPos
    const headingPath = nodePos.path
      .filter((x: any) => x?.type?.name === TIPTAP_NODES.HEADING_TYPE)
      .map((x: any) => slugify(x.firstChild?.textContent?.toLowerCase()?.trim() || ''))

    const url = new URL(window.location.href)
    url.searchParams.set('h', headingPath.join('>'))
    url.searchParams.set('id', headingId)
    window.history.replaceState({}, '', url)
  }

  // Scroll to heading
  targetHeading.scrollIntoView({ behavior: 'smooth', block: 'start' })

  // Open chat room if requested
  if (openChatRoom) {
    PubSub.publish(CHAT_OPEN, { headingId })
  }
}

/**
 * Scrolls to the document title (first heading)
 */
export function scrollToDocTitle(options: {
  workspaceId?: string
  title: string
  openChatRoom?: boolean
}) {
  const { workspaceId, title, openChatRoom = false } = options

  document
    .querySelector('.tiptap__editor.docy_editor .heading')
    ?.scrollIntoView({ behavior: 'smooth' })

  if (!workspaceId) return

  const url = new URL(window.location.href)
  url.searchParams.set('h', slugify(title.toLowerCase().trim()))
  url.searchParams.set('id', workspaceId)
  window.history.replaceState({}, '', url)

  if (openChatRoom) {
    PubSub.publish(CHAT_OPEN, { headingId: workspaceId })
  }
}

/**
 * Builds nested structure from flat TOC items based on level
 */
export function buildNestedToc<T extends { level: number }>(
  items: T[]
): Array<{ item: T; children: T[] }> {
  const result: Array<{ item: T; children: T[] }> = []

  for (let i = 0; i < items.length; ) {
    const item = items[i]
    const children: T[] = []
    let j = i + 1

    // Collect all items with higher level (deeper nesting) as children
    while (j < items.length && items[j].level > item.level) {
      children.push(items[j])
      j++
    }

    result.push({ item, children })
    i = j
  }

  return result
}
