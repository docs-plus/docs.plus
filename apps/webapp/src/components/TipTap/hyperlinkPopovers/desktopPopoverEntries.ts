import {
  type CreateHyperlinkOptions,
  type EditHyperlinkOptions,
  getDefaultController
} from '@docs.plus/extension-hyperlink'
import type { Editor } from '@tiptap/core'

import { buildEditRequest } from './buildEditRequest'
import { applyCreate } from './commands/applyCreate'
import { setActivePopover } from './hyperlinkPopoverStore'
import type { ActivePopover } from './types'

/** Ask the controller to hide. close() emits `idle`, the store subscriber clears `active`, and the portal unmounts. */
const dismiss = (editor: Editor) => {
  getDefaultController().close()
  if (!editor.isDestroyed) editor.commands.focus()
}

const buildHost = (testId: string): HTMLElement => {
  const host = document.createElement('div')
  host.dataset.testid = testId
  return host
}

const buildCreateProps = (opts: CreateHyperlinkOptions): ActivePopover['props'] => ({
  mode: 'create',
  editor: opts.editor,
  initialHref: typeof opts.attributes?.href === 'string' ? opts.attributes.href : '',
  validate: opts.validate,
  defaultSuggestionsState: 'collapsed',
  onApply: ({ href, text }) => {
    const applied = applyCreate(opts, { href, text })
    if (applied) dismiss(opts.editor)
    return applied
  },
  onClose: () => dismiss(opts.editor)
})

const buildEditProps = (opts: EditHyperlinkOptions): ActivePopover['props'] => {
  const { apply, ...request } = buildEditRequest(opts)
  return {
    ...request,
    defaultSuggestionsState: 'collapsed',
    onApply: (result) => {
      const applied = apply(result)
      if (applied) dismiss(opts.editor)
      return applied
    },
    onClose: () => dismiss(opts.editor)
  }
}

export function createHyperlinkDesktop(opts: CreateHyperlinkOptions): HTMLElement {
  const host = buildHost('hyperlink-create-popover')
  setActivePopover({ host, props: buildCreateProps(opts) })
  return host
}

export function editHyperlinkDesktop(opts: EditHyperlinkOptions): HTMLElement {
  const host = buildHost('hyperlink-edit-popover')
  setActivePopover({ host, props: buildEditProps(opts) })
  return host
}
