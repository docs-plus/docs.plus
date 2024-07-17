import MobileLayout from './MobileLayout'
import DesktopLayout from './DesktopLayout'
import React from 'react'
import useEditorAndProvider from '@hooks/useEditorAndProvider'

const DocumentLayouts = ({ isMobile }: { isMobile: boolean }) => {
  useEditorAndProvider()

  return isMobile ? <MobileLayout /> : <DesktopLayout />
}

export default DocumentLayouts
