import React from 'react'
import PadTitle from '@components/TipTap/pad-title-section/PadTitle'
import DesktopEditor from '../components/DesktopEditor'
import { useStore } from '@stores'

const DesktopLayout = () => {
  const {
    settings: {
      editor: { isMobile }
    }
  } = useStore((state) => state)

  const deviceClass = isMobile ? 'm_mobile' : 'm_desktop'

  return (
    <div className={`pad tiptap flex flex-col border-solid ${deviceClass}`}>
      <PadTitle />
      <DesktopEditor />
    </div>
  )
}

export default DesktopLayout
