import Controllers from '@components/pages/editor/Controllers'
import { createDocumentFromStructure } from '@components/pages/editor/helpers/createDocumentFromStructure'
import { HyperlinkPopoverPortal } from '@components/TipTap/hyperlinkPopovers/HyperlinkPopoverPortal'
import editorConfig from '@components/TipTap/TipTap'
import EditorToolbar from '@components/TipTap/toolbar/desktop/EditorToolbar'
import { TocDesktop } from '@components/toc/TocDesktop'
import { TocHeader } from '@components/toc/TocHeader'
import { moveHeadingById } from '@components/toc/utils/moveHeading'
import { useStore } from '@stores'
import { Editor, EditorContent as TiptapEditor, useEditor } from '@tiptap/react'
import { GetServerSideProps } from 'next'
import { useEffect } from 'react'

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
    _getMarkdown?: () => string
    _parseMarkdown?: (md: string) => Record<string, unknown> | undefined
    /** Cypress escape hatch: lets specs seed Zustand state (e.g. `workspaceId` to enable bookmark RPC). Playground-only — production routes never touch this. */
    _store?: typeof useStore
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

    // Expose heading move for Cypress tests
    window._moveHeading = (sourceId, targetId, position, newLevel) => {
      return moveHeadingById(editor, sourceId, targetId, position, newLevel)
    }

    // Expose Markdown helpers for Cypress tests
    window._getMarkdown = () => editor.getMarkdown()
    window._parseMarkdown = (md: string) => editor.markdown?.parse(md)

    // Expose the Zustand store so specs can seed slices the playground
    // doesn't populate naturally (workspaceId, etc.).
    window._store = useStore

    setWorkspaceEditorSetting('instance', editor)
    setWorkspaceEditorSetting('loading', false)
    setWorkspaceEditorSetting('providerSyncing', false)

    return () => {
      delete window._moveHeading
      delete window._getMarkdown
      delete window._parseMarkdown
      delete window._store
    }
  }, [editor])

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="toolbars bg-base-100 w-full shrink-0">
        <EditorToolbar />
        <Controllers editor={editor} />
      </div>

      {/* Main content with TOC sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* TOC Sidebar */}
        <aside className="border-base-300 bg-base-100 flex w-64 shrink-0 flex-col overflow-hidden border-r">
          <TocHeader variant="desktop" />
          <div className="scrollbar-custom scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2">
            <TocDesktop />
          </div>
        </aside>

        {/* Editor */}
        <main className="flex-1 overflow-auto">
          <div className="pad tiptap history_editor flex flex-col border-solid">
            <div className="editor relative flex size-full flex-row justify-around align-top">
              <div className="mainWrapper relative flex w-full max-w-full flex-col align-top">
                <div className="editorWrapper scrollbar-custom scrollbar-thin bg-base-200 flex h-full grow items-start justify-center overflow-y-auto scroll-smooth border-t-0 px-3 py-4 sm:px-6 sm:py-6">
                  <TiptapEditor className={`tiptap__editor docy_editor relative`} editor={editor} />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <HyperlinkPopoverPortal />
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
