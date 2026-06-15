import { fetchDocument } from '@utils/fetchDocument'
import { logger } from '@utils/logger'
import { isReservedSlug } from '@utils/reservedSlugs'
import { createClient } from '@utils/supabase/server-props'
import { type GetServerSidePropsContext } from 'next'

import { getDeviceInfo } from './getDeviceInfo'

const AUTH_TIMEOUT_MS = 5000

export const documentServerSideProps = async (context: GetServerSidePropsContext) => {
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

  try {
    // Verify user authentication (server-validated); on timeout degrade to public access
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
      // Timeout or error - continue without user (public access)
      logger.warn('Auth check failed, continuing as public user', { error })
    }

    // Only get session if user is authenticated (prevents security warning)
    let session = null
    if (user && !userError) {
      try {
        const sessionPromise = supabase.auth.getSession()
        const sessionTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Session timeout')), AUTH_TIMEOUT_MS)
        )
        const sessionResult = (await Promise.race([sessionPromise, sessionTimeout])) as any
        session = sessionResult?.data?.session || null
      } catch (error) {
        // Timeout or error - continue without session
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
    logger.error('[getServerSideProps error]', error, { documentSlug })

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
