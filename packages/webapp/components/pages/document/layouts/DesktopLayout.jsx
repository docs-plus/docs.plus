import { useEditorStateContext } from '@context/EditorContext'
import PadTitle from '@components/TipTap/pad-title-section/PadTitle'
import { useEffect } from 'react'
import Editor from '../components/Editor'

const DesktopLayout = ({ docMetadata }) => {
  const { isMobile } = useEditorStateContext()

  useEffect(() => {
    // when layout change set editor editable again
    // editor?.setEditable(true)
    const divProseMirror = document.querySelector('.ProseMirror')
    divProseMirror?.setAttribute('contenteditable', 'true')
    document.querySelector('html').classList.remove('m_mobile')
  }, [])

  return (
    <>
      <div className={`pad tiptap flex flex-col border-solid ${isMobile ? ' m_mobile' : 'm_desktop'}`}>
        <div className="docTitle w-full min-h-14 px-2 py-3 flex flex-row items-center sm:border-b-0 border-b">
          <PadTitle docMetadata={docMetadata} />
        </div>
        <Editor docMetadata={docMetadata} />
      </div>
    </>
  )
}

export default DesktopLayout
