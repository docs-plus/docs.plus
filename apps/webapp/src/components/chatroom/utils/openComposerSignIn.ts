import SignInForm from '@components/auth/SignInForm'
import { useStore } from '@stores'
import { createElement } from 'react'

/** Opens the global sign-in dialog; preserves return-to-channel in the URL. */
export function openComposerSignIn(channelId: string) {
  const url = new URL(window.location.href)
  url.searchParams.set('open_heading_chat', channelId)
  window.history.pushState({}, '', url.href)

  const { openDialog, closeDialog } = useStore.getState()
  openDialog(createElement(SignInForm, { showHeader: true, onClose: closeDialog }), {
    size: 'sm',
    dismissible: true
  })
}
