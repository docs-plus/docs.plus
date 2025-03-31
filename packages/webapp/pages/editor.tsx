import { Editor, EditorContent as TiptapEditor, useEditor } from '@tiptap/react'
import editorConfig from '@components/TipTap/TipTap'
import ToolbarDesktop from '@components/TipTap/toolbar/ToolbarDesktop'
import { useEffect } from 'react'
import { useStore } from '@stores'
import { GetServerSideProps } from 'next'
import Controllers from '@components/pages/editor/Controllers'
import { createDocumentFromStructure } from '@components/pages/editor/helpers/createDocumentFromStructure'
// Add this type for our props
type EditorPageProps = {
  localPersistence: boolean
  docName: string
}

declare global {
  interface Window {
    _createDocumentFromStructure: (structure: any) => boolean
    _editor?: Editor
  }
}

const EditorPage = ({ localPersistence, docName }: EditorPageProps) => {
  const editor = useEditor(
    editorConfig({
      provider: null,
      spellcheck: false,
      localPersistence,
      docName
    }),
    []
  )
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)

  useEffect(() => {
    if (!editor) return
    // tiptap instance
    window._editor = editor

    // Updated implementation that handles the specific document structure format
    window._createDocumentFromStructure = createDocumentFromStructure({ editor })

    setWorkspaceEditorSetting('instance', editor)
    setWorkspaceEditorSetting('loading', false)
    setWorkspaceEditorSetting('providerSyncing', false)
  }, [editor])

  return (
    <div className="relative flex h-auto flex-col overflow-auto">
      <div className="toolbars w-full bg-white">
        <ToolbarDesktop />
        <Controllers editor={editor} />
      </div>
      <div className="pad tiptap history_editor flex flex-col border-solid">
        <div className="editor relative flex size-full flex-row justify-around align-top">
          <div className="mainWrapper relative flex w-full max-w-full flex-col align-top">
            <div className="editorWrapper flex h-full grow items-start justify-center overflow-y-auto border-t-0 p-0 sm:py-4">
              <TiptapEditor className={`tiptap__editor docy_editor relative`} editor={editor} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Add getServerSideProps
export const getServerSideProps: GetServerSideProps<EditorPageProps> = async ({ query }) => {
  return {
    props: {
      localPersistence: query.localPersistence === 'true',
      docName: (query.docName as string) || 'example-document'
    }
  }
}

export default EditorPage
