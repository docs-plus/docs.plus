import React from 'react'
import MobilePadTitle from '@components/TipTap/pad-title-section/MobilePadTitle'
import FilterModal from '../components/FilterModal'
import MobileEditor from '../components/MobileEditor'
import { useStore } from '@stores'

const MobileLayout = () => {
  const {
    settings: {
      editor: { isMobile }
    }
  } = useStore((state) => state)

  const deviceClass = isMobile ? 'm_mobile' : 'm_desktop'

  return (
    <div className={`pad tiptap relative flex flex-col border-solid ${deviceClass}`}>
      <div className="docTitle sticky top-0 z-10 flex min-h-14 w-full flex-row items-center bg-white">
        <MobilePadTitle />
      </div>
      <MobileEditor />
      <div className="nd_modal bottom nd_filterModal fixed top-0 z-30 hidden size-full">
        <FilterModal />
      </div>
    </div>
  )
}

export default MobileLayout
