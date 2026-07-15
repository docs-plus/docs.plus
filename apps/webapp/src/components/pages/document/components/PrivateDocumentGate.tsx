import Button from '@components/ui/Button'
import { modalPanelFrameClassName } from '@components/ui/Dialog'
import { GlobalDialog } from '@components/ui/GlobalDialog'
import { DocsPlusIcon, Icons } from '@icons'
import { openInlineSignInDialog } from '@utils/openInlineSignInDialog'
import { type PrivateGateVariant, toPrivateGateVariant } from '@utils/toPrivateGateVariant'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { twMerge } from 'tailwind-merge'

export type { PrivateGateVariant }
export { toPrivateGateVariant }

const GATE_COPY: Record<PrivateGateVariant, { title: string; body: string }> = {
  'sign-in-required': {
    title: 'This document is private',
    body: 'Sign in to view this document.'
  },
  'access-denied': {
    title: 'You don’t have access to this document',
    body: 'Only the owner can open it.'
  }
}

// Brand-led access shell (Approach B): wordmark above card, one primary inside,
// text escapes under the card. Mounts GlobalDialog because DocumentPage never loads.
const PrivateDocumentGate = ({
  variant,
  slug,
  title
}: {
  variant: PrivateGateVariant
  slug: string
  title?: string | null
}) => {
  const router = useRouter()
  const copy = GATE_COPY[variant]
  const context = title ? `${title} · docs.plus/${slug}` : `docs.plus/${slug}`
  const goHome = () => router.push('/')

  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-[var(--pad-well)] px-4 py-8">
      <div className="flex w-full max-w-sm flex-col items-center motion-safe:animate-[doc-region-in_220ms_ease-out_both]">
        <Link
          href="/"
          className="text-base-content mb-5 inline-flex items-center gap-2 no-underline"
          aria-label="docs.plus home">
          <DocsPlusIcon size={28} />
          <span className="text-lg font-bold tracking-tight">docs.plus</span>
        </Link>

        <div
          className={twMerge(
            modalPanelFrameClassName,
            'flex w-full flex-col items-center px-6 py-8 text-center sm:px-8'
          )}>
          <div className="bg-base-200 mb-3 flex size-12 items-center justify-center rounded-full">
            <Icons.lock size={22} className="text-base-content/40" aria-hidden />
          </div>
          <h1 className="text-base-content text-lg font-semibold">{copy.title}</h1>
          <p className="text-base-content/70 mt-2 text-sm">{copy.body}</p>

          {variant === 'sign-in-required' ? (
            <Button
              type="button"
              variant="primary"
              shape="block"
              className="mt-6 min-h-12"
              onClick={() => openInlineSignInDialog({ returnTo: router.asPath })}>
              Sign in
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              shape="block"
              className="mt-6 min-h-12"
              onClick={goHome}>
              Create a document
            </Button>
          )}
        </div>

        {variant === 'sign-in-required' ? (
          <div className="text-base-content/60 mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm font-medium">
            <button
              type="button"
              className="hover:text-base-content min-h-11 px-1 hover:underline"
              onClick={goHome}>
              Create a document
            </button>
            <span className="text-base-300" aria-hidden>
              ·
            </span>
            <button
              type="button"
              className="hover:text-base-content min-h-11 px-1 hover:underline"
              onClick={goHome}>
              Homepage
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="text-base-content/60 hover:text-base-content mt-4 min-h-11 px-1 text-sm font-medium hover:underline"
            onClick={goHome}>
            Homepage
          </button>
        )}

        <p className="text-base-content/50 mt-3 text-center text-xs break-all">{context}</p>
      </div>
      <GlobalDialog />
    </div>
  )
}

export default PrivateDocumentGate
