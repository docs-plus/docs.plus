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
    <ModalDrawer modalId="mobile_history_panel" position="right">
      <Sidebar className="bg-base-100 h-full w-full max-w-none border-l-0" />
    </ModalDrawer>
  )
}

const MobileHistory = () => {
  const hocuspocusProvider = useStore((state) => state.settings.hocuspocusProvider)
  const editor = useEditor(editorConfig({ editable: false }), [hocuspocusProvider])
  const setEditor = useStore((state) => state.setEditor)

  useEffect(() => {
    if (editor) setEditor(editor)
  }, [editor])

  useHocuspocusStateless()

  return (
    <div className="mobileLayoutRoot pad tiptap history_editor border-base-300 flex min-h-0 w-full flex-col overflow-hidden border-solid">
      <Toolbar />
      <div className="min-h-0 flex-1 overflow-hidden">
        <EditorContent />
      </div>
      <MobileLeftSidePanel />
    </div>
  )
}

export default MobileHistory
