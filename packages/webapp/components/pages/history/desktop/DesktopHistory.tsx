import React, { useEffect } from 'react'
import { useEditor } from '@tiptap/react'
import { useStore } from '@stores'
import editorConfig from '@components/TipTap/TipTap'
import Toolbar from './Toolbar'
import EditorContent from './EditorContent'
import Sidebar from './Sidebar'
import { useHocuspocusStateless } from '../hooks/useHocuspocusStateless'

const DesktopHistory = () => {
  const { hocuspocusProvider } = useStore((state) => state.settings)
  const editor = useEditor(editorConfig({ editable: false }), [hocuspocusProvider])
  const { setEditor } = useStore((state) => state)

  useEffect(() => {
    if (editor) setEditor(editor)
  }, [editor])

  useHocuspocusStateless()

  if (!editor) return null

  return (
    <div className="pad tiptap history_editor flex h-full flex-col border-solid">
      <div className="editor relative flex size-full flex-row justify-around align-top">
        <div className="mainWrapper relative flex w-[78%] max-w-full flex-col align-top">
          <Toolbar />
          <EditorContent />
        </div>
        <Sidebar />
      </div>
    </div>
  )
}

export default DesktopHistory
