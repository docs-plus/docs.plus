import PadTitle from '@components/TipTap/pad-title-section/PadTitle'
import { useEffect } from 'react'
import Editor from '../components/Editor'
import { useStore } from '@stores'

const DesktopLayout = () => {
  const {
    editor: { isMobile }
  } = useStore((state) => state.settings)

  // TODO: reconsider this
  useEffect(() => {
    document.querySelector('html').classList.remove('m_mobile')
  }, [])

  return (
    <>
      <div
        className={`pad tiptap flex flex-col border-solid ${isMobile ? ' m_mobile' : 'm_desktop'}`}>
        <div className="docTitle bg-white z-20 relative w-full min-h-14 px-2 py-3 flex flex-row items-center sm:border-b-0 border-b">
          <PadTitle />
        </div>
        <Editor />
      </div>
    </>
  )
}

export default DesktopLayout
