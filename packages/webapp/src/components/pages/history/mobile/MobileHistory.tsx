import { useEditor } from '@tiptap/react'
import { useStore } from '@stores'
import { useHocuspocusStateless } from '../hooks/useHocuspocusStateless'
import { useEffect } from 'react'
import editorConfig from '@components/TipTap/TipTap'
import Toolbar from './Toolbar'
import EditorContent from './EditorContent'
import { ModalDrawer } from '@components/ui/ModalDrawer'
import Sidebar from '../desktop/Sidebar'

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
    <div
      className={`pad tiptap history_editor relative flex flex-col border-solid border-gray-300`}>
      <Toolbar />
      <EditorContent />
      <MobileLeftSidePanel />
    </div>
  )
}

export default MobileHistory
