import PubSub from 'pubsub-js'
import slugify from 'slugify'
import { TIPTAP_EVENTS, TIPTAP_NODES } from '@types'
import type { Editor } from '@tiptap/react'
import { CHAT_OPEN } from '@services/eventsHub'

/**
 * Toggle fold/unfold state for a TOC item
 */
export const toggleHeadingSection = (id: string) => {
  const itemElement = document.querySelector(`.toc__item[data-id="${id}"]`) as HTMLElement
  if (!itemElement) return

  const btnFoldElement = itemElement.querySelector('.btnFold') as HTMLElement
  const childrenWrapperElement = itemElement.querySelector('.childrenWrapper')

  itemElement.classList.toggle('closed')
  btnFoldElement?.classList.toggle('closed')
  btnFoldElement?.classList.toggle('opened')
  childrenWrapperElement?.classList.toggle('hidden')

  PubSub.publish(TIPTAP_EVENTS.FOLD_AND_UNFOLD, {
    headingId: id,
    open: !itemElement.classList.contains('closed')
  })
}

/**
 * Scroll to a heading by ID and update URL
 */
export const scrollToHeading = (editor: Editor, id: string) => {
  const targetHeading = document.querySelector(`.heading[data-id="${id}"]`)
  if (!targetHeading) return

  // Update URL with heading path
  const posAt = editor.view.posAtDOM(targetHeading, 0)
  if (posAt === -1) return

  const nodePos = editor.view.state.doc.resolve(posAt)
  // @ts-ignore - path is internal ProseMirror API
  const headingPath = nodePos.path
    .filter((x: any) => x?.type?.name === TIPTAP_NODES.HEADING_TYPE)
    .map((x: any) => slugify(x.firstChild?.textContent?.toLowerCase().trim() || ''))

  const url = new URL(window.location.href)
  url.searchParams.set('h', headingPath.join('>'))
  url.searchParams.set('id', id)
  window.history.replaceState({}, '', url)

  targetHeading.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/**
 * Scroll to document title and optionally open chat
 */
export const scrollToTitle = ({
  workspaceId,
  title,
  openChatRoom
}: {
  workspaceId?: string
  title: string
  openChatRoom: boolean
}) => {
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
