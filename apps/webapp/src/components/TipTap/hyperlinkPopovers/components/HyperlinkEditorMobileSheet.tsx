import { SheetActionFooter } from '@components/SheetActionFooter'
import { SheetLayout } from '@components/SheetLayout'
import type { ReactNode } from 'react'

import type { HyperlinkEditorForm } from '../hooks/useHyperlinkEditorForm'
import { HyperlinkEditorFields } from './HyperlinkEditorFields'

type Props = {
  form: HyperlinkEditorForm
  onBack?: () => void
  onClose?: () => void
  onSubmit: (event: React.FormEvent) => void
}

export function HyperlinkEditorMobileSheet({ form, onBack, onClose, onSubmit }: Props): ReactNode {
  const { sheetTitle } = form

  return (
    <form noValidate onSubmit={onSubmit} className="contents">
      <SheetLayout
        title={sheetTitle}
        onClose={onClose}
        body="stack"
        footer={
          <SheetActionFooter
            onBack={onBack}
            backTestId="hyperlink-editor-back"
            submitTestId="hyperlink-editor-submit"
          />
        }>
        <HyperlinkEditorFields form={form} />
      </SheetLayout>
    </form>
  )
}
