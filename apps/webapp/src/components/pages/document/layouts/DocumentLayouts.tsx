import type { HocuspocusProvider } from '@hocuspocus/provider'
import { useHashRouter } from '@hooks/useHashRouter'
import React from 'react'

import DesktopLayout from './DesktopLayout'
import MobileLayout from './MobileLayout'
import PadEditorLifecycle from './PadEditorLifecycle'

const DocumentLayouts = ({
  isMobile,
  provider
}: {
  isMobile: boolean
  provider: HocuspocusProvider
}) => {
  const { isHistoryView } = useHashRouter()

  return (
    <>
      {!isHistoryView && <PadEditorLifecycle provider={provider} />}
      {isMobile ? <MobileLayout /> : <DesktopLayout />}
    </>
  )
}

export default DocumentLayouts
