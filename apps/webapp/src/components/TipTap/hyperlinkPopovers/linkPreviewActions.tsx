import { Icons } from '@components/icons/registry'
import * as toast from '@components/toast'
import { copyToClipboard } from '@docs.plus/extension-hyperlink'
import { isDocumentEditingLocked } from '@hooks/isDocumentEditingLocked'
import type { SheetDataMap } from '@stores'
import { useSheetStore } from '@stores'
import type { ReactNode } from 'react'

import { applyEdit } from './commands/applyEdit'
import { removeHyperlinkAtPos } from './commands/removeHyperlinkAtPos'
import { navigateHref } from './hrefEventHandler'
import { runInternalDocumentLink } from './internalDocumentLinkActions'
import { getHyperlinkDisplayText } from './linkMarkUtils'
import type { LinkDestination } from './types'

const ICON_SIZE = 16

export interface LinkPreviewAction {
  key: string
  label: string
  icon: ReactNode
  onClick: () => void
  danger?: boolean
}

type BuildLinkPreviewActionsArgs = {
  payload: SheetDataMap['linkPreview']
  destination: LinkDestination
  closeSheet: () => void
  switchSheet: ReturnType<typeof useSheetStore.getState>['switchSheet']
  onCopySuccess: () => void
}

export function buildLinkPreviewActions({
  payload,
  destination,
  closeSheet,
  switchSheet,
  onCopySuccess
}: BuildLinkPreviewActionsArgs): LinkPreviewAction[] {
  const { href, editor, nodePos, isAllowedUri } = payload
  const internalLink = destination.kind === 'here' ? destination.link : null

  const openAction: LinkPreviewAction = {
    key: 'open',
    label: internalLink ? 'Go to destination' : 'Open link',
    icon: internalLink ? (
      <Icons.chevronRight size={ICON_SIZE} />
    ) : (
      <Icons.externalLink size={ICON_SIZE} />
    ),
    onClick: () => {
      if (internalLink) runInternalDocumentLink(internalLink)
      else navigateHref(href, isAllowedUri)
      closeSheet()
    }
  }

  const actions: LinkPreviewAction[] = [
    openAction,
    {
      key: 'copy',
      label: 'Copy link',
      icon: <Icons.copy size={ICON_SIZE} />,
      onClick: () => {
        copyToClipboard(href, (ok) => {
          if (ok) onCopySuccess()
          else toast.Error('Failed to copy to clipboard')
        })
      }
    }
  ]
  // No `nodePos`: the link is not in the pad (a chat message), so there is no mark to change.
  if (nodePos === undefined) return actions
  // Not `view.editable`: phone read mode turns it off for every reader. The durable lock marks a read-only document.
  if (isDocumentEditingLocked()) return actions

  return [
    ...actions,
    {
      key: 'edit',
      label: 'Edit link',
      icon: <Icons.pencil size={ICON_SIZE} />,
      onClick: () => {
        switchSheet('linkEditor', {
          mode: 'edit',
          editor,
          initialHref: href,
          initialText: getHyperlinkDisplayText(editor, { nodePos, href }),
          onSubmit: (result) => applyEdit({ editor, nodePos, expectedHref: href }, result),
          onBack: () => switchSheet('linkPreview', { href, editor, nodePos, isAllowedUri })
        })
      }
    },
    {
      key: 'remove',
      label: 'Remove link',
      icon: <Icons.unlink size={ICON_SIZE} />,
      danger: true,
      onClick: () => {
        removeHyperlinkAtPos({ editor, nodePos, expectedHref: href })
        closeSheet()
      }
    }
  ]
}
