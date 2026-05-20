import { useStore } from '@stores'

import { ComposerDesktopLayout } from './ComposerDesktopLayout'
import { ComposerMobileLayout } from './ComposerMobileLayout'

export const ComposerLayout = () => {
  const isMobile = useStore((state) => state.settings.editor.isMobile)
  return isMobile ? <ComposerMobileLayout /> : <ComposerDesktopLayout />
}
