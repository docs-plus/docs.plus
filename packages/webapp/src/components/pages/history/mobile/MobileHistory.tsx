import editorConfig from '@components/TipTap/TipTap'
import { ModalDrawer } from '@components/ui/ModalDrawer'
import { useStore } from '@stores'
import { useEditor } from '@tiptap/react'
import { useEffect } from 'react'

import Sidebar from '../desktop/Sidebar'
import { useHocuspocusStateless } from '../hooks/useHocuspocusStateless'
import EditorContent from './EditorContent'
import Toolbar from './Toolbar'

const MobileLeftSidePanel = () => {
  return (
    <ModalDrawer modalId="mobile_history_panel" position="right" width={76}>
      <Sidebar className="w-[76%]" />
    </ModalDrawer>
  )
}

const MobileHistory = () => {
  const { hocuspocusProvider } = useStore((state) => state.settings)
  const editor = useEditor(editorConfig({ editable: false }), [hocuspocusProvider])
  const { setEditor } = useStore((state) => state)

  useEffect(() => {
    if (editor) setEditor(editor)
  }, [editor])

  useHocuspocusStateless()

  return (
    <div className="pad tiptap history_editor border-base-300 relative flex h-dvh min-h-0 flex-col border-solid">
      <Toolbar />
      <div className="min-h-0 flex-1 overflow-hidden">
        <EditorContent />
      </div>
      <MobileLeftSidePanel />
    </div>
  )
}

export default MobileHistory
