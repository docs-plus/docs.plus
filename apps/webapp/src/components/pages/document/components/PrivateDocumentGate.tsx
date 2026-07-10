import { Icons } from '@icons'
import { openInlineSignInDialog } from '@utils/openInlineSignInDialog'
import { useRouter } from 'next/router'

export type PrivateGateVariant = 'sign-in-required' | 'access-denied'

const GATE_COPY: Record<PrivateGateVariant, { title: string; body: string }> = {
  'sign-in-required': {
    title: 'This document is private',
    body: 'Sign in to view this document.'
  },
  'access-denied': {
    title: 'You don’t have access to this document',
    body: 'This document is private. Only the owner can open it.'
  }
}

// Full-viewport access shell for private slugs — mounted BEFORE any provider so a
// blocked viewer never opens a WS connection. Variants differ only in copy + CTA order.
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
    <div className="bg-base-200 flex min-h-dvh w-full flex-col items-center justify-center px-4">
      <div className="bg-base-100 border-base-300 rounded-box flex w-full max-w-md flex-col items-center gap-3 border p-6 text-center sm:p-8">
        <Icons.lock size={32} className="text-base-content/60" />
        <h1 className="text-base-content text-lg font-semibold">{copy.title}</h1>
        <p className="text-base-content/70 text-sm">{copy.body}</p>
        <p className="text-base-content/50 text-sm break-all">{context}</p>

        {variant === 'sign-in-required' ? (
          <div className="mt-2 flex w-full flex-col items-center gap-2">
            <button
              className="btn btn-primary min-h-12 w-full"
              onClick={() => openInlineSignInDialog({ returnTo: router.asPath })}>
              Sign in
            </button>
            <button className="btn btn-ghost w-full" onClick={goHome}>
              Create a document
            </button>
            <button className="link link-hover text-base-content/60 mt-1 text-sm" onClick={goHome}>
              Go to homepage
            </button>
          </div>
        ) : (
          <div className="mt-2 flex w-full flex-col items-center gap-2">
            <button className="btn btn-primary min-h-12 w-full" onClick={goHome}>
              Create a document
            </button>
            <button className="btn btn-ghost w-full" onClick={goHome}>
              Go to homepage
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default PrivateDocumentGate
