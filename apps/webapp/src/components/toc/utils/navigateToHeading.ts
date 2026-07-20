import { CHAT_OPEN } from '@services/eventsHub'
import type { Editor } from '@tiptap/react'
import { TIPTAP_NODES } from '@types'
import { scrollToHeading as scrollPadHeading } from '@utils/scrollToHeading'
import PubSub from 'pubsub-js'
import slugify from 'slugify'

export type NavigateToHeadingOptions = {
  openChat?: boolean
  updateUrl?: boolean
}

/** TOC navigate: URL h/id + pad scroll (block start). Optional CHAT_OPEN — never focusEditor. */
export function navigateToHeading(
  editor: Editor,
  headingId: string,
  options: NavigateToHeadingOptions = {}
): void {
  const { openChat = false, updateUrl = true } = options

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

  scrollPadHeading(headingId, { behavior: 'smooth', block: 'start' })

  if (openChat) {
    PubSub.publish(CHAT_OPEN, { headingId })
  }
}

/** Doc-title row: pad scroll via first H1 toc-id + URL/chat for workspace channel. */
export function navigateToDocTitle(options: {
  workspaceId?: string
  title: string
  openChat?: boolean
}): void {
  const { workspaceId, title, openChat = false } = options

  const docTitleHeading = document.querySelector(
    '.tiptap__editor.docy_editor h1[data-toc-id]'
  ) as HTMLElement | null
  const titleTocId = docTitleHeading?.getAttribute('data-toc-id')
  if (titleTocId) {
    scrollPadHeading(titleTocId, { behavior: 'smooth', block: 'start' })
  }

  if (!workspaceId) return

  const url = new URL(window.location.href)
  url.searchParams.set('h', slugify(title.toLowerCase().trim()))
  url.searchParams.set('id', workspaceId)
  window.history.replaceState({}, '', url)

  if (openChat) {
    PubSub.publish(CHAT_OPEN, { headingId: workspaceId })
  }
}
