import { HomepageLink, PageCard } from '@components/PageCard'
import Button, { quietActionClassName } from '@components/ui/Button'
import { GlobalDialog } from '@components/ui/GlobalDialog'
import { openInlineSignInDialog } from '@utils/openInlineSignInDialog'
import { supabaseClient } from '@utils/supabase'
import type { PrivateGateVariant } from '@utils/toPrivateGateVariant'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useRef } from 'react'

const GATE_COPY: Record<PrivateGateVariant, { title: string; body: string }> = {
  'sign-in-required': {
    title: 'This document is private',
    body: 'Sign in to view this document.'
  },
  'access-denied': {
    title: 'You don’t have access to this document',
    body: 'Only the owner can open it.'
  },
  'check-unavailable': {
    title: 'We couldn’t check this document',
    body: 'The server could not verify your access right now. Try again in a moment.'
  }
}

// One primary in the body; address and ways out in the strip. Mounts GlobalDialog because
// DocumentPage never loads.
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
  const reaskedRef = useRef(false)

  // OAuth and the magic link return through a full page load, so
  // getServerSideProps ran before the browser exchanged `?code=`. The Google
  // popup hydrates this tab on SIGNED_IN with no reload. Either way this prop
  // can be stale. Re-ask the server — never decide access here (SR-1).
  useEffect(() => {
    if (variant !== 'sign-in-required') return

    const { data } = supabaseClient.auth.onAuthStateChange((event, session) => {
      if ((event !== 'INITIAL_SESSION' && event !== 'SIGNED_IN') || !session?.user) return
      if (reaskedRef.current) return
      reaskedRef.current = true
      // Non-shallow, so getServerSideProps re-runs with the new auth cookie.
      // `shallow: true` would skip it and silently do nothing. The fragment-free
      // form keeps `onlyAHashChange` from swallowing a `#history` deep link.
      router.replace(window.location.pathname + window.location.search, undefined, {
        scroll: false
      })
    })

    return () => data.subscription.unsubscribe()
  }, [variant, router])

  return (
    <>
      <PageCard
        title={copy.title}
        description={copy.body}
        meta={context}
        actions={
          <>
            {variant === 'sign-in-required' && (
              <Link href="/" className={quietActionClassName}>
                Create a document
              </Link>
            )}
            <HomepageLink />
          </>
        }>
        {variant === 'sign-in-required' ? (
          <Button
            type="button"
            variant="primary"
            shape="block"
            onClick={() => openInlineSignInDialog({ returnTo: router.asPath })}>
            Sign in
          </Button>
        ) : variant === 'check-unavailable' ? (
          // The server never decided access, so retrying the same URL is the only
          // gesture that can help. Signing in would not change the answer.
          <Button type="button" variant="primary" shape="block" onClick={() => router.reload()}>
            Try again
          </Button>
        ) : (
          <Button type="button" variant="primary" shape="block" onClick={goHome}>
            Create a document
          </Button>
        )}
      </PageCard>
      <GlobalDialog />
    </>
  )
}

export default PrivateDocumentGate
