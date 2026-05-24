import { Icons } from '@components/icons/registry'
import { copyToClipboard } from '@docs.plus/extension-hyperlink'
import type { SheetDataMap } from '@stores'
import { useSheetStore } from '@stores'
import { getMarkRange } from '@tiptap/core'
import type { ReactNode } from 'react'

import { applyEdit } from './commands/applyEdit'
import { navigateHref } from './hrefEventHandler'

const ICON_SIZE = 20

export interface LinkPreviewAction {
  key: string
  label: string
  icon: ReactNode
  onClick: () => void
  danger?: boolean
}

type BuildLinkPreviewActionsArgs = {
  payload: SheetDataMap['linkPreview']
  closeSheet: () => void
  switchSheet: ReturnType<typeof useSheetStore.getState>['switchSheet']
}

export function buildLinkPreviewActions({
  payload,
  closeSheet,
  switchSheet
}: BuildLinkPreviewActionsArgs): LinkPreviewAction[] {
  const { href, editor, nodePos, attrs, isAllowedUri } = payload

  return [
    {
      key: 'open',
      label: 'Open link',
      icon: <Icons.externalLink size={ICON_SIZE} />,
      onClick: () => {
        navigateHref(href, isAllowedUri)
        closeSheet()
      }
    },
    {
      key: 'copy',
      label: 'Copy link',
      icon: <Icons.copy size={ICON_SIZE} />,
      onClick: () => {
        copyToClipboard(href, (ok) => {
          if (ok) closeSheet()
          else console.error('Failed to copy to clipboard')
        })
      }
    },
    {
      key: 'edit',
      label: 'Edit link',
      icon: <Icons.pencil size={ICON_SIZE} />,
      onClick: () => {
        // attrs.title is metadata, not the visible anchor label — seed from the mark range.
        const $pos = editor.state.doc.resolve(nodePos)
        const mark = editor.schema.marks.hyperlink
        const range = mark ? getMarkRange($pos, mark) : null
        const initialText = range
          ? editor.state.doc.textBetween(range.from, range.to, '')
          : undefined

        switchSheet('linkEditor', {
          mode: 'edit',
          editor,
          initialHref: href,
          initialText,
          onSubmit: (result) => applyEdit({ editor, nodePos }, result),
          onBack: () => switchSheet('linkPreview', { href, editor, nodePos, attrs, isAllowedUri })
        })
      }
    },
    {
      key: 'remove',
      label: 'Remove link',
      icon: <Icons.unlink size={ICON_SIZE} />,
      danger: true,
      onClick: () => {
        editor.chain().focus().unsetHyperlink().run()
        closeSheet()
      }
    }
  ]
}
