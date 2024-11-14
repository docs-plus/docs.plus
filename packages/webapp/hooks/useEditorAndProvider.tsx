import { useEditor } from '@tiptap/react'
import { useEffect } from 'react'
import editorConfig from '@components/TipTap/TipTap'
import useApplyFilters from '@hooks/useApplyFilters'
import { useStore } from '@stores'
import useProviderAwarness from './useProviderAwarness'
import useEditorEditableState from './useEditorEditableState'
import useEditorReadOnly from './useEditorReadOnly'
import useInitializeNewDocument from './useInitializeNewDocument'
import useCheckUrlAndOpenHeadingChat from './useCheckUrlAndOpenHeadingChat'

const useEditorAndProvider = ({ provider }: { provider: any }) => {
  const { editor: editorSetting } = useStore((state) => state.settings)

  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)
  const editor = useEditor(editorConfig({ provider }), [editorSetting?.applyingFilters])

  // Set initial content if the document is new
  useInitializeNewDocument({ editor, provider })
  useCheckUrlAndOpenHeadingChat()

  useProviderAwarness()
  useEditorEditableState()
  useEditorReadOnly()
  useApplyFilters()

  // set the editor instance to the store and loading state
  useEffect(() => {
    if (!editor) return
    setWorkspaceEditorSetting('instance', editor)
    setWorkspaceEditorSetting('loading', false)
  }, [editor])

  // The selection has changed.
  useEffect(() => {
    if (!editor || editorSetting?.loading) return

    editor.on('selectionUpdate', ({ editor }) => {
      setWorkspaceEditorSetting('selectionPos', editor.state.selection?.$anchor?.pos)
    })

    return () => {
      editor.off('selectionUpdate')
    }
  }, [editor, editorSetting?.loading])

  return { editor, provider }
}

export default useEditorAndProvider
