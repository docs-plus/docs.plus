import { useHistoryHash } from '@components/pages/history/historyShareUrl'
import type { HocuspocusProvider } from '@hocuspocus/provider'
import { useStore } from '@stores'
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
  const { isHistory } = useHistoryHash()

  // The store holds the iPad-corrected answer, and both child layouts already read it.
  // The prop is that field's own server seed, used until the ssr:false hook writes it.
  const isMobileDevice = useStore((state) => state.settings.editor.isMobile) ?? isMobile

  return (
    <>
      {!isHistory && <PadEditorLifecycle provider={provider} />}
      {isMobileDevice ? <MobileLayout /> : <DesktopLayout />}
    </>
  )
}

export default DocumentLayouts
