import { Banner } from '@components/ui/Banner'
import Button from '@components/ui/Button'
import { Icons } from '@icons'
import { openInlineSignInDialog } from '@utils/openInlineSignInDialog'
import { getNeedsAuthCopy } from '@utils/providerCollabStatus'

// Full sheet width: 56rem is the sheet's max width. `100vw - 2rem` keeps a 16px end gap on the
// phone pad, which has no end padding. The alert role stays: edits stop saving until sign-in.
const SessionExpiredBanner = ({ onSignIn = openInlineSignInDialog }: { onSignIn?: () => void }) => {
  const { banner } = getNeedsAuthCopy()

  return (
    <Banner
      tone="warning"
      role="alert"
      icon={Icons.cloudOff}
      className="sticky top-0 z-10 my-4 w-full max-w-[min(56rem,calc(100vw-2rem))]"
      actions={
        <Button variant="quiet" onClick={onSignIn}>
          Sign in
        </Button>
      }>
      <span>{banner}</span>
    </Banner>
  )
}

export default SessionExpiredBanner
