import { useStore } from '@stores'

import { DesktopLayout } from './DesktopLayout'
import { MobileLayout } from './MobileLayout'

/**
 * Smart Editor component that renders the appropriate layout based on device type
 *
 * Automatically switches between Mobile and Desktop layouts based on the
 * device detection in the store. Provides a responsive message editing experience.
 *
 * @example
 * <MessageComposer.Editor />
 */
export const Editor = () => {
  const isMobile = useStore((state) => state.settings.editor.isMobile)

  // Render appropriate layout based on device type
  return isMobile ? <MobileLayout /> : <DesktopLayout />
}
