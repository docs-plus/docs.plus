import { useStore } from '@stores'
import MobileDetect from 'mobile-detect'

// The store flag is unset outside the document shell, so fall back to the same
// user-agent test the server runs. A narrow window is not the mobile shell.
export const isMobileSurface = (): boolean =>
  useStore.getState().settings.editor.isMobile ??
  Boolean(new MobileDetect(window.navigator.userAgent).mobile())
