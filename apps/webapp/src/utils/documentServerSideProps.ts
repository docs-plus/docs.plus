import { isReservedSlug, padUrlCore } from '@docs.plus/pad-url'
import { type Session } from '@supabase/supabase-js'
import { DocumentFetchError, fetchDocument } from '@utils/fetchDocument'
import { logger } from '@utils/logger'
import { captureGsspDocumentError } from '@utils/observability'
import { createClient } from '@utils/supabase/server-props'
import { isAuthUnavailable, toPrivateGateVariant } from '@utils/toPrivateGateVariant'
import { type GetServerSidePropsContext } from 'next'

import { getDeviceInfo } from './getDeviceInfo'

const AUTH_TIMEOUT_MS = 5000

/**
 * Asks REST for the social card (`card=1`) with the sub-ids of the one place the link opens
 * (`?version=`, else `padUrlCore.place`). Only a full page load renders the head.
 * A person who opens a shared chat link waits on the chat read too, by design.
 */
const cardQueryOf = (context: GetServerSidePropsContext): URLSearchParams | undefined => {
  if (context.req.headers['x-nextjs-data']) return undefined
  const facets = padUrlCore.parse(context.resolvedUrl, 'http://pad.invalid')
  if (!facets) return undefined
  const params = new URLSearchParams({ card: '1' })
  const { version } = context.query
  if (typeof version === 'string') {
    params.set('version', version)
    return params
  }
  const place = padUrlCore.place(facets)
  if (place.kind === 'heading') params.set('id', place.headingId)
  if (place.kind === 'chat') {
    params.set('c', place.linkId)
    if (place.messageId) params.set('m', place.messageId)
  }
  if (place.kind === 'filter') {
    for (const term of place.terms) params.append('t', term)
    if (place.mode === 'and') params.set('mode', 'and')
  }
  return params
}

export const documentServerSideProps = async (context: GetServerSidePropsContext) => {
  // The document shell is client-rendered, so its `noindex` <Head> never reaches a
  // crawler. Set it on every response here, redirects and 404s included.
  context.res.setHeader('X-Robots-Tag', 'noindex, nofollow')

  const { query } = context
  const documentSlug = query.slugs?.at(0)

  // Reserved names resolve to a concrete app route or a Next.js system path —
  // never a document. Defensive: concrete routes shadow this catch-all anyway.
  if (isReservedSlug(documentSlug)) {
    return {
      notFound: true
    }
  }

  const { isMobile, deviceType, os } = getDeviceInfo(context)

  const supabase = createClient(context)

  // Hoisted so the catch block can fall back to session presence when a 403 arrives.
  let session: Session | null = null

  try {
    let user = null
    let userError = null
    try {
      const authPromise = supabase.auth.getUser()
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Auth timeout')), AUTH_TIMEOUT_MS)
      )
      const result = (await Promise.race([authPromise, timeoutPromise])) as any
      user = result?.data?.user || null
      userError = result?.error || null
    } catch (error) {
      logger.warn('Auth check failed, continuing as public user', { error })
    }

    // Only get session if user is authenticated (prevents security warning)
    if (user && !userError) {
      try {
        const sessionPromise = supabase.auth.getSession()
        const sessionTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Session timeout')), AUTH_TIMEOUT_MS)
        )
        const sessionResult = (await Promise.race([sessionPromise, sessionTimeout])) as any
        session = sessionResult?.data?.session || null
      } catch (error) {
        logger.warn('Session check failed, continuing without session', { error })
      }
    }

    const docMetadata = await fetchDocument(documentSlug, session, cardQueryOf(context))

    // Page props carry no token. The service worker caches the HTML and the
    // `/_next/data` response, and its header rule cannot see a token in a body.
    // The client reads the session from the same auth cookies.
    return {
      props: {
        docMetadata,
        isMobile,
        deviceType,
        os,
        isAuthed: Boolean(session)
      }
    }
  } catch (error: unknown) {
    const fetchError = error instanceof DocumentFetchError ? error : null

    // A private doc answers 503 AUTH_UNAVAILABLE while the backend cannot verify tokens.
    // A Traefik 503 (every replica pulled from the pool) carries no code, so it stays a
    // real error with a Sentry issue.
    const authUnavailable = fetchError != null && isAuthUnavailable(fetchError)
    if (authUnavailable) {
      logger.warn('[getServerSideProps] auth verification unavailable', { documentSlug })
    }

    // Private docs return 403 with an `access` hint — render the gate, never /500.
    // Blocked viewers get no description/ownerProfile/keywords in props (docMetadata: null).
    if (fetchError?.status === 403 || authUnavailable) {
      return {
        props: {
          gateVariant: toPrivateGateVariant({
            access: fetchError?.access,
            status: fetchError?.status,
            code: fetchError?.code,
            hasSession: Boolean(session)
          }),
          slug: documentSlug ?? null,
          gateTitle: null,
          docMetadata: null,
          isMobile,
          deviceType,
          os
        }
      }
    }

    logger.error('[getServerSideProps error]', error, { documentSlug })
    captureGsspDocumentError(error, {
      tags: { surface: 'gssp-document' },
      extra: { documentSlug: documentSlug ?? null }
    })

    const errorMessage = error instanceof Error ? error.message : String(error)
    const message = errorMessage.includes("(reading 'isPrivate')")
      ? `Something went wrong on our server side. We're looking into it!`
      : errorMessage

    return {
      redirect: {
        destination: `/500?error=${encodeURIComponent(message)}`,
        permanent: false
      }
    }
  }
}
