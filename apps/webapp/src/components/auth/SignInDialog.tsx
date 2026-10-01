import { FooterStrip } from '@components/PageCard'
import { ModalBody, ModalClose, ModalDescription, ModalHeading } from '@components/ui/Dialog'

import SignInForm from './SignInForm'

export function SignInDialog({ returnTo }: { returnTo?: string }) {
  return (
    <SignInForm returnTo={returnTo}>
      {({ sent, title, description, body, back }) => (
        <>
          <ModalBody>
            <div className="flex flex-col gap-1" role={sent ? 'status' : undefined}>
              <ModalHeading className="pr-10">{title}</ModalHeading>
              {description ? <ModalDescription>{description}</ModalDescription> : null}
            </div>
            <ModalClose />
            {body}
          </ModalBody>
          <FooterStrip meta={back} />
        </>
      )}
    </SignInForm>
  )
}
