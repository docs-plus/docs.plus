import { Editor, EditorContent as TiptapEditor, useEditor } from '@tiptap/react'
import editorConfig from '@components/TipTap/TipTap'
import ToolbarDesktop from '@components/TipTap/toolbar/ToolbarDesktop'
import { useEffect } from 'react'
import { useStore, useEditorPreferences, applyEditorPreferences } from '@stores'
import { GetServerSideProps } from 'next'
import Controllers from '@components/pages/editor/Controllers'
import { createDocumentFromStructure } from '@components/pages/editor/helpers/createDocumentFromStructure'
import { TocDesktop } from '@components/toc/TocDesktop'
import { moveHeadingById } from '@components/toc/utils/moveHeading'

// Add this type for our props
type EditorPageProps = {
  localPersistence: boolean
  docName: string
}

declare global {
  interface Window {
    _createDocumentFromStructure: (structure: any) => boolean
    _editor?: Editor
    _moveHeading?: (
      sourceId: string,
      targetId: string,
      position: 'before' | 'after',
      newLevel?: number
    ) => boolean
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
  const setPreference = useEditorPreferences((state) => state.setPreference)

  // Always enable indent heading and h1 section break on this page
  useEffect(() => {
    setPreference('indentHeading', true)
    setPreference('h1SectionBreak', true)
    applyEditorPreferences({ indentHeading: true, h1SectionBreak: true })
  }, [setPreference])

  useEffect(() => {
    if (!editor) return
    // tiptap instance
    window._editor = editor

    // Updated implementation that handles the specific document structure format
    window._createDocumentFromStructure = createDocumentFromStructure({ editor })

    // Expose heading move for Cypress tests
    window._moveHeading = (sourceId, targetId, position, newLevel) => {
      return moveHeadingById(editor, sourceId, targetId, position, newLevel)
    }

    setWorkspaceEditorSetting('instance', editor)
    setWorkspaceEditorSetting('loading', false)
    setWorkspaceEditorSetting('providerSyncing', false)

    return () => {
      delete window._moveHeading
    }
  }, [editor])

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="toolbars w-full shrink-0 bg-white">
        <ToolbarDesktop />
        <Controllers editor={editor} />
      </div>

      {/* Main content with TOC sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* TOC Sidebar */}
        <aside className="border-base-300 bg-base-100 w-64 shrink-0 overflow-y-auto border-r">
          <TocDesktop className="p-2" />
        </aside>

        {/* Editor */}
        <main className="flex-1 overflow-auto">
          <div className="pad tiptap history_editor flex flex-col border-solid">
            <div className="editor relative flex size-full flex-row justify-around align-top">
              <div className="mainWrapper relative flex w-full max-w-full flex-col align-top">
                <div className="editorWrapper flex h-full grow items-start justify-center overflow-y-auto border-t-0 p-0 sm:py-4">
                  <TiptapEditor className={`tiptap__editor docy_editor relative`} editor={editor} />
                </div>
              </div>
            </div>
          </div>
        </main>
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
