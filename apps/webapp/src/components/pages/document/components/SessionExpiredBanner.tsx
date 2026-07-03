import { Icons } from '@icons'
import { openInlineSignInDialog } from '@utils/openInlineSignInDialog'
import { getNeedsAuthCopy } from '@utils/providerCollabStatus'

const SessionExpiredBanner = ({ onSignIn = openInlineSignInDialog }: { onSignIn?: () => void }) => {
  const { banner } = getNeedsAuthCopy()

  return (
    <div
      role="alert"
      className="alert alert-warning sticky top-0 z-10 mx-auto mt-4 w-fit py-2 text-sm">
      <Icons.cloudOff size={18} />
      <span>{banner}</span>
      <button type="button" className="btn btn-neutral btn-xs" onClick={onSignIn}>
        Sign in
      </button>
    </div>
  )
}

export default SessionExpiredBanner
