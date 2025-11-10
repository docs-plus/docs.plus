import { useStore } from '@stores'
import { MobileLayout, DesktopLayout } from '.'

const Editor = () => {
  const {
    settings: {
      editor: { isMobile }
    }
  } = useStore((state) => state)

  return isMobile ? <MobileLayout /> : <DesktopLayout />
}

export default Editor
