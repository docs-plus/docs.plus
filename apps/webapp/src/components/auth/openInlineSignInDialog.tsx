import { useSheetStore, useStore } from '@stores'
import MobileDetect from 'mobile-detect'
import { createElement } from 'react'

import { SignInDialog } from './SignInDialog'

function shouldOpenSignInSheet() {
  if (typeof window === 'undefined') return false
  if (useStore.getState().settings.editor.isMobile) return true
  return Boolean(new MobileDetect(window.navigator.userAgent).mobile())
}

/** Phone/tablet UA: `signIn` BottomSheet. Desktop: centered GlobalDialog. Never width. */
export function openInlineSignInDialog(options?: { returnTo?: string }) {
  if (shouldOpenSignInSheet()) {
    useSheetStore.getState().openSheet('signIn', { returnTo: options?.returnTo })
    return
  }

  const { openDialog, closeDialog } = useStore.getState()
  openDialog(createElement(SignInDialog, { returnTo: options?.returnTo, onClose: closeDialog }), {
    size: 'sm'
  })
}
