import React from 'react'
import PadTitle from '@components/TipTap/pad-title-section/PadTitle'
import FilterModal from '../components/FilterModal'
import Editor from '../components/Editor'
import { useStore } from '@stores'

const MobileLayout = () => {
  const {
    editor: { isMobile }
  } = useStore((state) => state.settings)

  const deviceType = isMobile ? 'mobile' : 'desktop'

  return (
    <>
      <div className={`pad tiptap relative flex flex-col border-solid ${deviceType}`}>
        <div className="docTitle sticky top-0 z-10 flex min-h-14 w-full flex-row items-center border-b bg-white p-2 sm:border-b-0">
          <PadTitle />
        </div>
        <Editor />
        <div className="nd_modal bottom nd_filterModal fixed top-0 z-30 hidden size-full ">
          <FilterModal />
        </div>
      </div>
    </>
  )
}

export default MobileLayout
