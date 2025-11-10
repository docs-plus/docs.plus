import { upsertWorkspace, getChannelsByWorkspaceAndUserids } from '@api'
import { fetchDocument } from '@utils/fetchDocument'
import { createClient } from '@utils/supabase/server-props'
import { type GetServerSidePropsContext } from 'next'
import { getDeviceInfo } from '@helpers'
import { logger } from '@utils/logger'

export async function handleUserSessionForServerProp(docMetadata: any, session: any) {
  console.log('session', {
    docMetadata,
session
})
  if (!session?.user) return null
  const [upsertResult, channelsResult] = await Promise.allSettled([
    upsertWorkspace({
      id: docMetadata.documentId,
      name: docMetadata.title,
      description: docMetadata.description,
      slug: docMetadata.slug,
      created_by: session.user.id
    }),
    getChannelsByWorkspaceAndUserids(docMetadata.documentId, session.user.id)
  ])

  console.log('upsertResult', {upsertResult})
  console.log('channelsResult', {channelsResult})

  if (upsertResult.status === 'rejected') {
    throw new Error('Failed to upsert workspace', { cause: upsertResult.reason })
  }

  if (channelsResult.status === 'rejected') {
    throw new Error('Failed to get channels', { cause: channelsResult.reason })
  }

  let channels = channelsResult.value as any

  // TODO: need db function to get all channels by workspaceId and not thread
  channels =
    channels?.data
      .filter((x: any) => x.workspace?.type && x.workspace?.type !== 'THREAD')
      .map((x: any) => ({ ...x, ...x.workspace })) || []

  return channels
}

export const documentServerSideProps = async (context: GetServerSidePropsContext) => {
  const { query } = context
  const documentSlug = query.slugs?.at(0)

  // Skip Next.js internal paths (_next, api, etc.) and system paths (.well-known, etc.)
  // These should be handled by Next.js itself or return 404
  // This prevents unnecessary API calls and errors for system requests
  if (
    documentSlug === '_next' ||
    documentSlug === 'api' ||
    documentSlug === '.well-known' ||
    documentSlug?.startsWith('_') ||
    documentSlug?.startsWith('.well-known')
  ) {
    return {
      notFound: true
    }
  }

  const { isMobile, os } = getDeviceInfo(context)

  const supabase = createClient(context)

  try {
    // Verify user authentication (server-validated)
    // Add timeout wrapper to prevent hanging (5s timeout)
    let user = null
    let userError = null
    try {
      const authPromise = supabase.auth.getUser()
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Auth timeout')), 5000)
      )
      const result = await Promise.race([authPromise, timeoutPromise]) as any
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
        // User is authenticated, safe to get session (5s timeout)
        const sessionPromise = supabase.auth.getSession()
        const sessionTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Session timeout')), 5000)
        )
        const sessionResult = await Promise.race([sessionPromise, sessionTimeout]) as any
        session = sessionResult?.data?.session || null
      } catch (error) {
        // Timeout or error - continue without session
        logger.warn('Session check failed, continuing without session', { error })
      }
    }

    const docMetadata = await fetchDocument(documentSlug, session)

    const channels = await handleUserSessionForServerProp(docMetadata, session)

    return {
      props: {
        channels: channels || null,
        docMetadata,
        isMobile,
        os,
        session
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
