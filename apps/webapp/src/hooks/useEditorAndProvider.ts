import editorConfig from '@components/TipTap/TipTap'
import type { HocuspocusProvider } from '@hocuspocus/provider'
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

const useEditorAndProvider = ({ provider }: { provider: HocuspocusProvider }) => {
  const setWorkspaceEditorSetting = useStore((state) => state.setWorkspaceEditorSetting)
  const editor = useEditor(
    editorConfig({ provider, spellcheck: false, docName: provider.configuration.name }),
    [provider]
  )

  useInitializeNewDocument({ editor, provider })
  useNewDocumentTip({ provider })
  useHandleDraftOnFocus({ editor, provider })
  useCheckUrlAndOpenHeadingChat()

  useProviderAwareness()
  useEditorEditableState()
  useEditorReadOnly()
  useApplyFilters()

  useEffect(() => {
    if (!editor) return
    setWorkspaceEditorSetting('instance', editor)
    setWorkspaceEditorSetting('loading', false)
    return () => {
      setWorkspaceEditorSetting('instance', null)
      setWorkspaceEditorSetting('loading', true)
    }
  }, [editor, setWorkspaceEditorSetting])

  return { editor, provider }
}

export default useEditorAndProvider
