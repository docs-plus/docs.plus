import editorConfig from '@components/TipTap/TipTap'
import useApplyFilters from '@hooks/useApplyFilters'
import { useStore } from '@stores'
import { useEditor } from '@tiptap/react'
import { useEffect } from 'react'

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

  // This tree mounts BEFORE first sync. Any hook here that reads the Ydoc/ymetadata
  // once (not event-driven) must guard on `settings.editor.providerSyncing`.

  // Set initial content if the document is new
  useInitializeNewDocument({ editor, provider })
  useNewDocumentTip({ provider })
  useHandleDraftOnFocus({ editor, provider })
  useCheckUrlAndOpenHeadingChat()

  useProviderAwareness()
  useEditorEditableState()
  useEditorReadOnly()
  useApplyFilters()

  // set the editor instance to the store and loading state
  useEffect(() => {
    if (!editor) return
    setWorkspaceEditorSetting('instance', editor)
    setWorkspaceEditorSetting('loading', false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  return { editor, provider }
}

export default useEditorAndProvider
