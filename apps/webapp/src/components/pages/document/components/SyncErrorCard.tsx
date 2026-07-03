import { Icons } from '@icons'
import { openInlineSignInDialog } from '@utils/openInlineSignInDialog'
import { getNeedsAuthCopy } from '@utils/providerCollabStatus'
import { twMerge } from 'tailwind-merge'

type SyncErrorVariant = 'offline' | 'server' | 'needs-auth'

const SYNC_ERROR_COPY: Record<
  Exclude<SyncErrorVariant, 'needs-auth'>,
  { title: string; body: string }
> = {
  offline: {
    title: "You're offline",
    body: 'We keep retrying automatically — check your connection.'
  },
  server: {
    title: "Can't reach the document server",
    body: 'We keep retrying automatically — check your connection.'
  }
}

function resolveSyncErrorVariant(offline?: boolean, needsAuth?: boolean): SyncErrorVariant {
  if (needsAuth) return 'needs-auth'
  if (offline) return 'offline'
  return 'server'
}

// Condition is derived live from store state in EditorContent, so a later onSynced
// self-heals this card without user action while Hocuspocus keeps auto-reconnecting.
const SyncErrorCard = ({
  offline,
  needsAuth,
  onSignIn = openInlineSignInDialog,
  className
}: {
  offline?: boolean
  needsAuth?: boolean
  onSignIn?: () => void
  className?: string
}) => {
  const variant = resolveSyncErrorVariant(offline, needsAuth)
  const copy = variant === 'needs-auth' ? getNeedsAuthCopy() : SYNC_ERROR_COPY[variant]

  return (
    <div
      role="alert"
      className={twMerge(
        'ProseMirror tiptap__editor flex w-full flex-col items-center justify-center gap-3 py-16 text-center',
        className
      )}>
      <Icons.cloudOff size={32} className="text-base-content/40" />
      <p className="text-base-content font-medium">{copy.title}</p>
      <p className="text-base-content/60 text-sm">{copy.body}</p>
      {variant === 'needs-auth' ? (
        <button className="btn btn-primary btn-sm mt-2" onClick={onSignIn}>
          Sign in
        </button>
      ) : (
        <button className="btn btn-primary btn-sm mt-2" onClick={() => window.location.reload()}>
          Reload
        </button>
      )}
    </div>
  )
}

export default SyncErrorCard
