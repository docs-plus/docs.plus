import type { ReactNode } from 'react'

import { useHyperlinkEditorForm } from '../hooks/useHyperlinkEditorForm'
import type { HyperlinkEditorProps } from '../types'
import { HyperlinkEditorDesktopPopover } from './HyperlinkEditorDesktopPopover'
import { HyperlinkEditorMobileSheet } from './HyperlinkEditorMobileSheet'

export function HyperlinkEditor(props: HyperlinkEditorProps): ReactNode {
  const form = useHyperlinkEditorForm(props)

  if (form.isDesktop) {
    return (
      <HyperlinkEditorDesktopPopover
        form={form}
        onBack={props.onBack}
        onSubmit={form.handleSubmit}
      />
    )
  }

  return (
    <HyperlinkEditorMobileSheet form={form} onBack={props.onBack} onSubmit={form.handleSubmit} />
  )
}
