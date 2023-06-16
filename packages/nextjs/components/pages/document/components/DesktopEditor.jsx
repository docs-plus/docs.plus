import Toolbar from '@components/TipTap/toolbar/Toolbar'
import Editor from '../components/Editor'
import TOC from '../components/Toc'
import editorConfig from '@components/TipTap/TipTap'
import useApplyFilters from '@hooks/useApplyFilters'
import { use, useEffect, useState } from 'react'
import { useEditor } from '@tiptap/react'
import useYdocAndProvider from '@hooks/useYdocAndProvider'
import { useEditorStateContext } from '@context/EditorContext'
import { useRouter } from 'next/router'
import { useUser } from '@supabase/auth-helpers-react'
import useProfileData from '@hooks/useProfileData'
import randomColor from 'randomcolor'

const scrollHeadingSelection = (event) => {
  const scrollTop = event.currentTarget.scrollTop
  const toc = document.querySelector('.toc__list')
  const tocLis = [...toc.querySelectorAll('.toc__item')]
  const closest = tocLis
    .map((li) => {
      li.classList.remove('active')
      return li
    })
    .filter((li) => {
      const thisOffsetTop = +li.getAttribute('data-offsettop') - 220
      return thisOffsetTop <= scrollTop // && nextSiblingOffsetTop >= scrollTop
    })
  closest.at(-1)?.classList.add('active')
  closest.at(-1)?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
    inline: 'nearest'
  })
}

const DesktopEditor = ({ docMetadata }) => {
  const router = useRouter()
  const { loadingProfileData, profileData, profileFetchingError } = useProfileData()
  const user = useUser()
  const { slugs } = router.query
  const { rendering, setRendering, loading, setIsMobile, isMobile, setLoading, applyingFilters, setApplyingFilters } =
    useEditorStateContext()

  // check if the document is in the filter mode
  useEffect(() => {
    if (slugs.length > 1) {
      setApplyingFilters(true)
    }
  }, [slugs, setApplyingFilters])

  // TODO: this cuase rerending 3 times
  const { ydoc, provider, loadedData, setLoadedData } = useYdocAndProvider(docMetadata.documentId, setLoading)

  useEffect(() => {
    if (provider) {
      provider.on('awarenessUpdate', ({ states }) => {
        // console.log(states)
      })

      if (profileData) {
        const lastUpdate = Date.now().toString()
        let bucketAddress = user?.user_metadata?.avatar_url || '/assets/avatar.svg'
        if (profileData?.avatar_url) {
          bucketAddress = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/public/${user.id}.png?${lastUpdate}`
        }

        provider.setAwarenessField('user', {
          name: profileData?.full_name || user.user_metadata.full_name,
          username: profileData?.username || user.user_metadata.user_name,
          avatar: bucketAddress,
          color: randomColor()
        })
      }
    }
  }, [provider, user, profileData])

  // TODO: this cuase rerending 1 times
  const editor = useEditor(editorConfig({ provider }), [loading, applyingFilters])

  useEffect(() => {
    // console.log({ editor, loading }, '=-=-=')
  }, [loading])

  useApplyFilters(editor, slugs, applyingFilters, setApplyingFilters, router, rendering)

  useEffect(() => {
    if (loading) return
    setRendering(false)
  }, [loading, setRendering])

  return (
    <>
      <div className="toolbars w-full bg-white h-auto z-10 sm:block fixed bottom-0 sm:relative">
        {editor ? (
          <Toolbar
            editor={editor}
            docId={docMetadata.documentId}
            documentDescription={docMetadata.description}
            keywords={docMetadata.keywords}
          />
        ) : (
          'Loading...'
        )}
      </div>
      <div className="editor w-full h-full flex relative flex-row-reverse align-top ">
        <div
          className="editorWrapper w-9/12 grow flex items-start justify-center overflow-y-auto p-0 border-t-0 sm:py-4"
          onScroll={scrollHeadingSelection}>
          <Editor editor={editor} />
        </div>
        <div className="max-w-xs w-3/12 overflow-hidden pb-4 sm:py-4 sm:pb-14 scroll-smooth hover:overflow-auto hover:overscroll-contain">
          <TOC editor={editor} />
        </div>
      </div>
    </>
  )
}

export default DesktopEditor
