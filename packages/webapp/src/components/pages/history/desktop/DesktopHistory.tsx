import editorConfig from '@components/TipTap/TipTap'
import { useStore } from '@stores'
import { useEditor } from '@tiptap/react'
import React, { useEffect } from 'react'

import { useHocuspocusStateless } from '../hooks/useHocuspocusStateless'
import EditorContent from './EditorContent'
import Sidebar from './Sidebar'
import Toolbar from './Toolbar'

const DesktopHistory = () => {
  const hocuspocusProvider = useStore((state) => state.settings.hocuspocusProvider)
  const editor = useEditor(editorConfig({ editable: false }), [hocuspocusProvider])
  const setEditor = useStore((state) => state.setEditor)

  useEffect(() => {
    if (editor) setEditor(editor)
  }, [editor])

  useHocuspocusStateless()

  if (!editor) return null

  return (
    <div className="pad tiptap history_editor bg-base-200 flex h-full min-h-0 flex-col overflow-hidden">
      <div className="editor relative flex min-h-0 min-w-0 flex-1 flex-row justify-around align-top">
        <div className="mainWrapper relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden align-top">
          <Toolbar />
          <EditorContent />
        </div>
        <Sidebar />
      </div>
    </div>
  )
}

export default DesktopHistory
