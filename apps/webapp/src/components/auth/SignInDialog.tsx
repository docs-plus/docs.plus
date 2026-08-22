import { ModalHeading } from '@components/ui/Dialog'

import SignInForm from './SignInForm'

export function SignInDialog({ returnTo, onClose }: { returnTo?: string; onClose: () => void }) {
  return (
    <div className="w-full p-6">
      <ModalHeading className="sr-only">Sign in</ModalHeading>
      <SignInForm returnTo={returnTo} onClose={onClose} />
    </div>
  )
}
