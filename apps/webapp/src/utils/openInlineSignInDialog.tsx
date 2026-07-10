import SignInForm from '@components/auth/SignInForm'
import { useStore } from '@stores'
import { createElement } from 'react'

/** Pad + document surfaces share one global sign-in dialog shell. */
export function openInlineSignInDialog(options?: { returnTo?: string }) {
  useStore
    .getState()
    .openDialog(
      createElement(
        'div',
        { className: 'w-full p-6 sm:p-8' },
        createElement(SignInForm, { variant: 'inline', returnTo: options?.returnTo })
      ),
      { size: 'md', className: 'overflow-hidden p-0' }
    )
}
