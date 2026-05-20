import { useStore } from '@stores'

import { ComposerDesktopChrome } from './ComposerDesktopChrome'
import { ComposerMobileChrome } from './ComposerMobileChrome'

export const Editor = () => {
  const isMobile = useStore((state) => state.settings.editor.isMobile)
  return isMobile ? <ComposerMobileChrome /> : <ComposerDesktopChrome />
}
