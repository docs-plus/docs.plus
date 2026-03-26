import { CHAT_OPEN } from '@services/eventsHub'
import type { Editor } from '@tiptap/react'
import { TIPTAP_NODES } from '@types'
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

  targetHeading.scrollIntoView({ behavior: 'smooth', block: 'start' })

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

  document.querySelector('.tiptap__editor.docy_editor h1')?.scrollIntoView({ behavior: 'smooth' })

  if (!workspaceId) return

  const url = new URL(window.location.href)
  url.searchParams.set('h', slugify(title.toLowerCase().trim()))
  url.searchParams.set('id', workspaceId)
  window.history.replaceState({}, '', url)

  if (openChatRoom) {
    PubSub.publish(CHAT_OPEN, { headingId: workspaceId })
  }
}

export function buildNestedToc<T extends { level: number }>(
  items: T[]
): Array<{ item: T; children: T[] }> {
  const result: Array<{ item: T; children: T[] }> = []

  for (let i = 0; i < items.length; ) {
    const item = items[i]
    const children: T[] = []
    let j = i + 1

    while (j < items.length && items[j].level > item.level) {
      children.push(items[j])
      j++
    }

    result.push({ item, children })
    i = j
  }

  return result
}
