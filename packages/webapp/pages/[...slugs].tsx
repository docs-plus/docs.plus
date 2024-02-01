import React, { useEffect, useState } from 'react'
import MobileDetect from 'mobile-detect'
import DesktopLayout from '@components/pages/document/layouts/DesktopLayout'
import MobileLayout from '@components/pages/document/layouts/MobileLayout'
import { getSupabaseSession } from '@utils/getSupabaseSession'
import useDocumentMetadata from '@hooks/useDocumentMetadata'
import { fetchDocument } from '@utils/fetchDocument'
import HeadSeo from '@components/HeadSeo'
import { DocumentMetadataProvider } from '@context/DocumentMetadataContext'
import { supabaseClient } from '@utils/supabase'
import { useStore, useAuthStore, useChatStore } from '@stores'
import { getChannels } from '@api'

const Document = ({ slugs, docMetadata }: any) => {
  useDocumentMetadata(slugs, docMetadata)
  const user = useAuthStore((state: any) => state.profile)
  const { title, description, keywords } = docMetadata
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)
  const setWorkspaceSetting = useStore((state) => state.setWorkspaceSetting)
  const bulkSetChannels = useChatStore((state: any) => state.bulkSetChannels)
  const {
    editor: { isMobile, applyingFilters }
  } = useStore((state) => state.settings)

  const isFilterMode = slugs.length > 1
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isFilterMode) {
      document.body.classList.add('filter-mode')
      setWorkspaceEditorSetting('applyingFilters', true)
    }
  }, [slugs, applyingFilters, isFilterMode])

  useEffect(() => {
    if (!docMetadata) return
    setWorkspaceSetting('workspaceId', docMetadata.documentId)
    setWorkspaceSetting('metadata', docMetadata)
  }, [docMetadata])

  useEffect(() => {
    const checkworkspace = async () => {
      setLoading(true)
      try {
        const data = await supabaseClient
          .from('workspaces')
          .upsert({
            id: docMetadata.documentId,
            name: docMetadata.title,
            description: docMetadata.description,
            slug: docMetadata.slug,
            created_by: user.id
          })
          .select()

        const { data: channels } = await getChannels(docMetadata.documentId)
        console.log({ channels })
        if (channels) bulkSetChannels(channels)
      } catch (error) {
        console.error('checkworkspace error:', error)
      } finally {
        setLoading(false)
      }
    }
    if (user) checkworkspace()
    else setLoading(false)
  }, [user])

  return (
    <>
      <HeadSeo
        title={title}
        description={description}
        keywords={keywords.length && keywords.join(',')}
      />
      {loading ? (
        <div className="w-full h-full flex items-center justify-center">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : (
        <DocumentMetadataProvider docMetadata={docMetadata}>
          {isMobile ? <MobileLayout /> : <DesktopLayout />}
        </DocumentMetadataProvider>
      )}
    </>
  )
}

export default Document

export async function getServerSideProps(context: any) {
  const slug = context.query.slugs.at(0)

  try {
    const session = await getSupabaseSession(context)
    const docMetadata = await fetchDocument(slug, session)
    const device = new MobileDetect(context.req.headers['user-agent'])

    return {
      props: {
        docMetadata,
        isMobile: device.mobile() ? true : false,
        slugs: context.query.slugs
      }
    }
  } catch (error: any) {
    console.error('getServerSideProps error:', error)
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
