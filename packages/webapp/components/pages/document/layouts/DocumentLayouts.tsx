import MobileLayout from './MobileLayout'
import DesktopLayout from './DesktopLayout'
import React from 'react'
import useEditorAndProvider from '@hooks/useEditorAndProvider'

const DocumentLayouts = ({ isMobile, provider }: { isMobile: boolean; provider: any }) => {
  useEditorAndProvider({ provider })

  return isMobile ? <MobileLayout /> : <DesktopLayout />
}

export default DocumentLayouts
