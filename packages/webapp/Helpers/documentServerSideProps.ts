import { upsertWorkspace, getChannelsByWorkspaceAndUserids } from '@api'
import { fetchDocument } from '@utils/fetchDocument'
import { createClient } from '@utils/supabase/server-props'
import { type GetServerSidePropsContext } from 'next'
import { getDeviceInfo, validateTurnstileAccess } from '@helpers'

export async function handleUserSessionForServerProp(docMetadata: any, session: any) {
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

  const { isMobile, os } = getDeviceInfo(context)

  const isTurnstileVerified = validateTurnstileAccess(context)

  if (!isTurnstileVerified) {
    return {
      props: {
        showTurnstile: true,
        isMobile,
        os
      }
    }
  }

  const supabase = createClient(context)

  try {
    const { data, error } = await supabase.auth.getSession()
    const docMetadata = await fetchDocument(documentSlug, data.session)

    if (error) console.error('[getUserSession]:', error)

    // TODO: security check, the getSession has security leak
    const channels = await handleUserSessionForServerProp(docMetadata, data.session)

    return {
      props: {
        channels: channels || null,
        docMetadata,
        showTurnstile: false,
        isMobile,
        os
      }
    }
  } catch (error: any) {
    console.error('[getServerSideProps error]:', error)

    const message = error.message.includes("(reading 'isPrivate')")
      ? `Something went wrong on our server side. We're looking into it!`
      : error.message

    return {
      redirect: {
        destination: `/500?error=${encodeURIComponent(message)}`,
        permanent: false
      }
    }
  }
}
