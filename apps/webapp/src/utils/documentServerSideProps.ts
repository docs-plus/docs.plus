import { type Session } from '@supabase/supabase-js'
import { DocumentFetchError, fetchDocument } from '@utils/fetchDocument'
import { logger } from '@utils/logger'
import { captureGsspDocumentError } from '@utils/observability'
import { isReservedSlug } from '@utils/reservedSlugs'
import { createClient } from '@utils/supabase/server-props'
import { isAuthUnavailable, toPrivateGateVariant } from '@utils/toPrivateGateVariant'
import { type GetServerSidePropsContext } from 'next'

import { getDeviceInfo } from './getDeviceInfo'

const AUTH_TIMEOUT_MS = 5000

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

    const docMetadata = await fetchDocument(documentSlug, session)

    // Workspace upsert + channel hydration are client-side concerns
    // (useMapDocumentAndWorkspace); shipping only the access token keeps the
    // refresh token out of __NEXT_DATA__.
    return {
      props: {
        docMetadata,
        isMobile,
        deviceType,
        os,
        accessToken: session?.access_token ?? null
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
          os,
          accessToken: session?.access_token ?? null
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
