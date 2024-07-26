import { useEditor } from '@tiptap/react'
import { useEffect } from 'react'
import editorConfig from '@components/TipTap/TipTap'
import useApplyFilters from '@hooks/useApplyFilters'
import useYdocAndProvider from '@hooks/useYdocAndProvider'
import { useStore, useAuthStore } from '@stores'
import useProviderAwarness from './useProviderAwarness'
import useEditorEditableState from './useEditorEditableState'
import useEditorReadOnly from './useEditorReadOnly'

const useEditorAndProvider = () => {
  const user = useAuthStore((state) => state.profile)
  const { editor: editorSetting, hocuspocusProvider: provider } = useStore(
    (state) => state.settings
  )
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)

  const editor = useEditor(editorConfig({ provider, ydoc: null, user }), [
    editorSetting?.loading,
    editorSetting?.applyingFilters,
    provider
  ])

  useEffect(() => {
    if (!editor || editorSetting.rendering) return
    setWorkspaceEditorSetting('instance', editor)
    setWorkspaceEditorSetting('loading', false)
  }, [editor, editorSetting.rendering])

  useProviderAwarness()
  useEditorEditableState()
  useEditorReadOnly()
  useApplyFilters()

  // useEffect(() => {
  //   if (editorSetting?.loading && editorSetting?.applyingFilters) return
  //   setWorkspaceEditorSetting('rendering', false)
  // }, [editorSetting?.loading, editorSetting?.applyingFilters])

  // FIXME: this cuase rerending other components that depend on useEditorStateContext! "Drill props down instead"
  // // The selection has changed.
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
