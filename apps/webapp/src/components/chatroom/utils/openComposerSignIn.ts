import { useChatStore } from '@stores'
import { openInlineSignInDialog } from '@utils/openInlineSignInDialog'

/**
 * Opens the shared sign-in dialog. Chat return lives on `returnTo`, not the current URL.
 * It carries the heading id, because a heading with no chat row has no channel id (#402).
 */
export function openComposerSignIn() {
  const headingId = useChatStore.getState().chatRoom.headingId
  const url = new URL(window.location.href)
  if (headingId) url.searchParams.set('open_heading_chat', headingId)
  openInlineSignInDialog({
    returnTo: `${url.pathname}${url.search}${url.hash}`
  })
}
