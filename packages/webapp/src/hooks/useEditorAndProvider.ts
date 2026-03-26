import editorConfig from '@components/TipTap/TipTap'
import useApplyFilters from '@hooks/useApplyFilters'
import { useStore } from '@stores'
import { useEditor } from '@tiptap/react'
import { useEffect } from 'react'

import useApplyOpenChatAndFocusOnMessage from './useApplyOpenChatAndFocusOnMessage'
import useCheckUrlAndOpenHeadingChat from './useCheckUrlAndOpenHeadingChat'
import useEditorEditableState from './useEditorEditableState'
import useEditorReadOnly from './useEditorReadOnly'
import useHandleDraftOnFocus from './useHandleDraftOnFocus'
import useInitializeNewDocument from './useInitializeNewDocument'
import useNewDocumentTip from './useNewDocumentTip'
import useProviderAwareness from './useProviderAwareness'

const useEditorAndProvider = ({ provider }: { provider: any }) => {
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)
  // Never put `applyingFilters` (or other UI flags) here — deps recreate the editor and
  // destroy ProseMirror, which feels like freezes/glitches. Visibility is handled in EditorContent.
  const editor = useEditor(editorConfig({ provider, spellcheck: false }), [provider])

  // Set initial content if the document is new
  useInitializeNewDocument({ editor, provider })
  useNewDocumentTip({ provider })
  useHandleDraftOnFocus({ editor, provider })
  useCheckUrlAndOpenHeadingChat()

  useProviderAwareness()
  useEditorEditableState()
  useEditorReadOnly()
  useApplyFilters()

  // a custom hook to apply open chatroom and focus on a message
  useApplyOpenChatAndFocusOnMessage()

  // set the editor instance to the store and loading state
  useEffect(() => {
    if (!editor) return
    setWorkspaceEditorSetting('instance', editor)
    setWorkspaceEditorSetting('loading', false)
  }, [editor])

  return { editor, provider }
}

export default useEditorAndProvider
