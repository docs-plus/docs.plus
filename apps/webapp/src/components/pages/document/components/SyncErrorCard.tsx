import { FooterStrip } from '@components/PageCard'
import Button from '@components/ui/Button'
import { modalPanelFrameClassName } from '@components/ui/Dialog'
import { Icons } from '@icons'
import { openInlineSignInDialog } from '@utils/openInlineSignInDialog'
import { getNeedsAuthCopy } from '@utils/providerCollabStatus'
import { twMerge } from '@utils/twMerge'
import { useId } from 'react'

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
// The frame is L0 (no shadow): it sits on the docked sheet, not over the page.
// The phone scroller has no right padding (the real editor adds it), so the card adds its own.
const SyncErrorCard = ({
  offline,
  needsAuth,
  className
}: {
  offline?: boolean
  needsAuth?: boolean
  className?: string
}) => {
  const variant = resolveSyncErrorVariant(offline, needsAuth)
  const copy = variant === 'needs-auth' ? getNeedsAuthCopy() : SYNC_ERROR_COPY[variant]
  const titleId = useId()

  return (
    <div
      className={twMerge(
        'ProseMirror tiptap__editor flex w-full flex-col items-center justify-center py-16 in-[.mobileLayoutRoot]:pr-4',
        className
      )}>
      <section
        role="status"
        aria-labelledby={titleId}
        className={twMerge(
          modalPanelFrameClassName,
          'w-[min(100%,400px)] overflow-hidden shadow-none'
        )}>
        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-start gap-2">
            <Icons.cloudOff size={16} className="text-error mt-0.5 shrink-0" aria-hidden />
            <h2 id={titleId} className="text-base-content text-sm font-semibold">
              {copy.title}
            </h2>
          </div>
          {variant === 'needs-auth' ? (
            <Button variant="primary" shape="block" onClick={() => openInlineSignInDialog()}>
              Sign in
            </Button>
          ) : (
            <Button variant="primary" shape="block" onClick={() => window.location.reload()}>
              Reload
            </Button>
          )}
        </div>
        <FooterStrip meta={copy.body} />
      </section>
    </div>
  )
}

export default SyncErrorCard
