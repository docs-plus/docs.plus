import { useStore } from '@stores'
import { MobileLayout } from './MobileLayout'
import { DesktopLayout } from './DesktopLayout'

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
  const {
    settings: {
      editor: { isMobile }
    }
  } = useStore((state) => state)

  // Render appropriate layout based on device type
  return isMobile ? <MobileLayout /> : <DesktopLayout />
}
