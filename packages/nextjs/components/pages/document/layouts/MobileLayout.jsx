import React, { useState, useEffect } from 'react'
import { useEditorStateContext } from '@context/EditorContext'
import PadTitle from '@components/TipTap/pad-title-section/PadTitle'
import FilterModal from '../components/FilterModal'
import MobileEditor from '../components/MobileEditor'
const MobileLayout = ({ docMetadata }) => {
  const { isMobile } = useEditorStateContext()

  return (
    <>
      <div className={`pad tiptap relative flex  flex-col border-solid ${isMobile ? 'm_mobile' : 'm_desktop'}`}>
        <div className="docTitle top-0 bg-white w-full min-h-14 p-2 flex flex-row items-center sm:border-b-0 border-b">
          <PadTitle docMetadata={docMetadata} />
        </div>
        <MobileEditor docMetadata={docMetadata} />
        <div className="nd_modal hidden bottom nd_filterModal w-full h-full fixed top-0 z-30 ">
          <FilterModal />
        </div>
      </div>
    </>
  )
}

export default MobileLayout
