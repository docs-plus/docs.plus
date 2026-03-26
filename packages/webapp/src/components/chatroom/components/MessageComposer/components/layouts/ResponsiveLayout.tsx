import { useStore } from '@stores'

import { DesktopLayout, MobileLayout } from '.'

const Editor = () => {
  const isMobile = useStore((state) => state.settings.editor.isMobile)

  return isMobile ? <MobileLayout /> : <DesktopLayout />
}

export default Editor
