import { SheetActionFooter } from '@components/SheetActionFooter'
import { SheetLayout } from '@components/SheetLayout'
import { sheetBodyPadClassName } from '@utils/sheetBodyPadding'
import type { ReactNode } from 'react'

import type { HyperlinkEditorForm } from '../hooks/useHyperlinkEditorForm'
import { HyperlinkEditorFields } from './HyperlinkEditorFields'

type Props = {
  form: HyperlinkEditorForm
  onBack?: () => void
  onSubmit: (event: React.FormEvent) => void
}

export function HyperlinkEditorMobileSheet({ form, onBack, onSubmit }: Props): ReactNode {
  const { sheetTitle, href } = form

  return (
    <form noValidate onSubmit={onSubmit} className="contents">
      <SheetLayout
        title={sheetTitle}
        footer={
          <SheetActionFooter
            primaryDisabled={!href.trim()}
            onBack={onBack}
            backTestId="hyperlink-editor-back"
            submitTestId="hyperlink-editor-submit"
          />
        }>
        <div className={`flex flex-col gap-2 py-3 ${sheetBodyPadClassName}`}>
          <HyperlinkEditorFields form={form} />
        </div>
      </SheetLayout>
    </form>
  )
}
