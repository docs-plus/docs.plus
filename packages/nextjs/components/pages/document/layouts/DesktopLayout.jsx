import { useEditorStateContext } from '@context/EditorContext'
import PadTitle from '@components/TipTap/pad-title-section/PadTitle'
import HeadSeo from '@components/HeadSeo'
import { useEffect } from 'react'
import DesktopEditor from '../components/DesktopEditor'
import { useState } from 'react'
import PubSub from 'pubsub-js'

import dynamic from 'next/dynamic'

const ControlCenter = dynamic(() => import('@components/ControlCenter'), {
  loading: () => <div>Loading...</div>
})

const DesktopLayout = ({ docMetadata }) => {
  const { isMobile } = useEditorStateContext()
  const { title, documentId, description, keywords } = docMetadata

  const [displayControlCenter, setDisplayControlCenter] = useState(false)

  const closeControlCenter = (e) => {
    if (e.target.id === 'controlCenterBlur') {
      setDisplayControlCenter(false)
    }
  }

  useEffect(() => {
    PubSub.subscribe('toggleControlCenter', (msg, data) => {
      // setAvatarUrl(newURL)
      setDisplayControlCenter(!displayControlCenter)
    })

    return () => PubSub.unsubscribe('toggleControlCenter')
  }, [])

  useEffect(() => {
    // when layout change set editor editable again
    // editor?.setEditable(true)
    const divProseMirror = document.querySelector('.ProseMirror')
    divProseMirror?.setAttribute('contenteditable', 'true')
    document.querySelector('html').classList.remove('m_mobile')
  }, [])

  return (
    <>
      <HeadSeo title={title} description={description} keywords={keywords && keywords?.join(',')} />
      <div className={`pad tiptap flex flex-col border-solid ${isMobile ? ' m_mobile' : 'm_desktop'}`}>
        <div className="docTitle w-full min-h-14 px-2 py-3 flex flex-row items-center sm:border-b-0 border-b">
          <PadTitle docId={documentId} docTitle={title} />
        </div>
        <DesktopEditor docMetadata={docMetadata} />
        {displayControlCenter && (
          <div
            onClick={closeControlCenter}
            id="controlCenterBlur"
            className="w-full h-full flex align-middle items-center justify-center absolute z-50 backdrop-blur-sm bg-slate-300/20 ">
            <ControlCenter />
          </div>
        )}
      </div>
    </>
  )
}

export default DesktopLayout
