import { Icons } from '@components/icons/registry'
import type { ReactNode } from 'react'

import type { HyperlinkEditorForm } from '../hooks/useHyperlinkEditorForm'
import {
  HyperlinkEditorError,
  HyperlinkEditorSuggestionList,
  HyperlinkEditorTextField,
  HyperlinkEditorUrlField
} from './HyperlinkEditorFields'

type Props = {
  form: HyperlinkEditorForm
  onBack?: () => void
  onSubmit: (event: React.FormEvent) => void
}

export function HyperlinkEditorDesktopPopover({ form, onBack, onSubmit }: Props): ReactNode {
  const { isCreate, href } = form

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="hyperlink-link-popover-shell flex w-fit max-w-[min(34rem,calc(100vw-2rem))] min-w-[26rem] flex-col gap-2 p-2">
      {!isCreate && (
        <div className="grid grid-cols-[minmax(0,1fr)_5rem] items-start gap-2">
          <HyperlinkEditorTextField form={form} />
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              data-testid="hyperlink-editor-back"
              className="btn btn-ghost min-h-10 w-20 shrink-0 justify-center self-start">
              <Icons.back size={18} aria-hidden />
            </button>
          ) : (
            <span className="w-20 shrink-0" aria-hidden />
          )}
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_5rem] items-start gap-2">
        <HyperlinkEditorUrlField form={form} />
        <button
          type="submit"
          disabled={!href.trim()}
          data-testid="hyperlink-editor-submit"
          className="btn btn-ghost min-h-10 w-20 shrink-0 justify-center self-start">
          Apply
        </button>
      </div>
      <HyperlinkEditorError form={form} />
      <HyperlinkEditorSuggestionList form={form} />
    </form>
  )
}
