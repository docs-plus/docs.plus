import React, { useEffect, useState, useCallback } from 'react'
import { useEditor } from '@tiptap/react'
import { useStore } from '@stores'
import * as Y from 'yjs'
import { ProsemirrorTransformer } from '@hocuspocus/transformer'
import editorConfig from '@components/TipTap/TipTap'
import Toolbar from './Toolbar'
import EditorContent from './EditorContent'
import Sidebar from './Sidebar'
import { useDocumentHistory } from './hooks/useDocumentHistory'
import { useVersionContent } from './hooks/useVersionContent'
import { useStatelessMessage } from './hooks/useStatelessMessage'

interface HistoryItem {
  version: number
  createdAt: string
  commitMessage?: string
}

export const getContentFromYdocObject = (content: string) => {
  const ydoc = new Y.Doc()
  const update = Uint8Array.from(atob(content), (c) => c.charCodeAt(0))
  Y.applyUpdate(ydoc, update)
  const prosemirrorJson = ProsemirrorTransformer.fromYdoc(ydoc)
  return prosemirrorJson.default
}

const DesktopHistory = () => {
  const { hocuspocusProvider } = useStore((state) => state.settings)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [currentVersion, setCurrentVersion] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentVersionContent, setCurrentVersionContent] = useState<string | null>(null)

  const editor = useEditor(editorConfig({ provider: null, spellcheck: false, editable: false }), [
    hocuspocusProvider
  ])
  const { fetchHistory } = useDocumentHistory()
  const { watchVersionContent } = useVersionContent(setCurrentVersion, setIsLoading)
  const { handleStatelessMessage } = useStatelessMessage({
    editor,
    setHistory,
    setCurrentVersion,
    watchVersionContent,
    setIsLoading,
    setCurrentVersionContent,
    setError
  })

  useEffect(() => {
    if (!hocuspocusProvider) return
    hocuspocusProvider.on('stateless', handleStatelessMessage)
    fetchHistory()

    return () => {
      hocuspocusProvider.off('stateless', handleStatelessMessage)
    }
  }, [hocuspocusProvider, handleStatelessMessage, fetchHistory])

  // Add this helper function inside the component
  const getCurrentVersionInfo = useCallback(() => {
    if (!currentVersion || !history.length) return null
    const versionInfo = history.find((item) => item.version === currentVersion)
    if (!versionInfo) return null

    return {
      ...versionInfo,
      isLatestVersion: history[0]?.version === currentVersion
    }
  }, [currentVersion, history])

  const restoreThisVerisonHandler = () => {
    if (window.confirm(`Are you sure you want to revert to version ${currentVersion}?`)) {
      setIsLoading(true)
      const {
        editor: { instance }
      } = useStore.getState().settings

      if (instance) {
        const meta = hocuspocusProvider.configuration.document.getMap('metadata')
        meta.set('commitMessage', `Reverted to version ${currentVersion}`)
        instance.commands.setContent(currentVersionContent)
        window.location.hash = ''
        // setTimeout(() => {
        //   fetchHistory()
        // }, 2000)
      }
    }
  }

  if (!editor) return null

  return (
    <div className="pad tiptap history_editor flex flex-col border-solid">
      <div className="editor relative flex size-full flex-row justify-around align-top">
        <div className="mainWrapper relative flex w-[78%] max-w-full flex-col align-top">
          <Toolbar
            getCurrentVersionInfo={getCurrentVersionInfo}
            currentVersion={currentVersion}
            historyLength={history.length}
            onRestore={restoreThisVerisonHandler}
          />
          <EditorContent editor={editor} isLoading={isLoading} />
        </div>

        <Sidebar
          isLoading={isLoading}
          history={history}
          currentVersion={currentVersion}
          watchVersionContent={watchVersionContent}
        />
      </div>
    </div>
  )
}

export default DesktopHistory
