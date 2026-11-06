import { CHAT_OPEN } from '@services/eventsHub'
import { padUrl } from '@services/padUrl'
import { useFocusedHeadingStore } from '@stores'
import { scrollToHeading as scrollPadHeading } from '@utils/scrollToHeading'
import PubSub from 'pubsub-js'

export type NavigateToHeadingOptions = {
  openChat?: boolean
}

/** TOC navigate: URL h/id + pad scroll (block start). Optional CHAT_OPEN — never focusEditor. */
export function navigateToHeading(headingId: string, options: NavigateToHeadingOptions = {}): void {
  const { openChat = false } = options

  // The spy lock holds until the heading lands, so focus stays on the clicked row.
  // Taken and released here, so no caller path can skip the release.
  const { setFocusedHeadingWithLock, releaseScrollLock } = useFocusedHeadingStore.getState()
  setFocusedHeadingWithLock(headingId)

  void padUrl.go({ kind: 'heading', headingId })

  scrollPadHeading(headingId, { behavior: 'smooth', block: 'start', onSettled: releaseScrollLock })

  if (openChat) {
    PubSub.publish(CHAT_OPEN, { headingId })
  }
}

/** Doc-title row: pad scroll via first H1 toc-id + URL/chat for workspace channel. */
export function navigateToDocTitle(options: { workspaceId?: string; openChat?: boolean }): void {
  const { workspaceId, openChat = false } = options

  const docTitleHeading = document.querySelector(
    '.tiptap__editor.docy_editor h1[data-toc-id]'
  ) as HTMLElement | null
  const titleTocId = docTitleHeading?.getAttribute('data-toc-id')
  if (titleTocId) {
    scrollPadHeading(titleTocId, { behavior: 'smooth', block: 'start' })
  }

  if (!workspaceId) return

  void padUrl.go({ kind: 'heading', headingId: workspaceId })

  if (openChat) {
    PubSub.publish(CHAT_OPEN, { headingId: workspaceId })
  }
}
