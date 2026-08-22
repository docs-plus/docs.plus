import { openInlineSignInDialog } from '@utils/openInlineSignInDialog'

/** Opens the shared sign-in dialog. Chat return lives on `returnTo`, not the current URL. */
export function openComposerSignIn(channelId: string) {
  const url = new URL(window.location.href)
  url.searchParams.set('open_heading_chat', channelId)
  openInlineSignInDialog({
    returnTo: `${url.pathname}${url.search}${url.hash}`
  })
}
