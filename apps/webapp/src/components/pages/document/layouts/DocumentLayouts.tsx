import { CommandJump } from '@components/commandJump/CommandJump'
import { useHistoryHash } from '@components/pages/history/historyShareUrl'
import type { HocuspocusProvider } from '@hocuspocus/provider'
import { usePadBookmarkStats } from '@hooks/usePadBookmarkStats'
import useReportTabReading from '@hooks/useReportTabReading'
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
  useReportTabReading(provider)
  // Here, not in a toolbar: both layouts show the dot, and a remount would blink it.
  usePadBookmarkStats()

  // The store holds the iPad-corrected answer, and both child layouts already read it.
  // The prop is that field's own server seed, used until the ssr:false hook writes it.
  const isMobileDevice = useStore((state) => state.settings.editor.isMobile) ?? isMobile

  return (
    <>
      {!isHistory && <PadEditorLifecycle provider={provider} />}
      {isMobileDevice ? <MobileLayout /> : <DesktopLayout />}
      <CommandJump surface="pad" />
    </>
  )
}

export default DocumentLayouts
