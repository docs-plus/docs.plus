import { type SheetDataMap, useSheetStore } from '@stores'

import { HyperlinkEditor } from './components/HyperlinkEditor'

interface LinkEditorSheetProps {
  data: SheetDataMap['linkEditor']
}

/** Mobile bottom-sheet wrapper. Editor is threaded through the sheet payload (set by the create/edit mobile adapters from `opts.editor`); no global reads. */
const LinkEditorSheet = ({ data: payload }: LinkEditorSheetProps) => {
  const closeSheet = useSheetStore((s) => s.closeSheet)

  return (
    <HyperlinkEditor
      mode={payload.mode}
      variant="mobile"
      editor={payload.editor}
      defaultSuggestionsState="browsing"
      initialHref={payload.initialHref}
      initialText={payload.initialText}
      validate={payload.validate}
      onApply={(result) => {
        const applied = payload.onSubmit(result)
        if (applied !== false) closeSheet()
        return applied
      }}
      onBack={payload.onBack}
      onClose={closeSheet}
    />
  )
}

export default LinkEditorSheet
