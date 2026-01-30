import useEditorAndProvider from '@hooks/useEditorAndProvider'
import React from 'react'

import DesktopLayout from './DesktopLayout'
import MobileLayout from './MobileLayout'

const DocumentLayouts = ({ isMobile, provider }: { isMobile: boolean; provider: any }) => {
  useEditorAndProvider({ provider })

  return isMobile ? <MobileLayout /> : <DesktopLayout />
}

export default DocumentLayouts
