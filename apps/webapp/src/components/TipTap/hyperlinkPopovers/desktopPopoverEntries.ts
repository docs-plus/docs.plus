import {
  type CreateHyperlinkOptions,
  type EditHyperlinkOptions,
  getDefaultController
} from '@docs.plus/extension-hyperlink'
import type { Editor } from '@tiptap/core'

import { applyCreate } from './commands/applyCreate'
import { applyEdit } from './commands/applyEdit'
import { handleEditBack } from './handleEditBack'
import { setActivePopover } from './hyperlinkPopoverStore'
import { getHyperlinkDisplayText, storedHrefOf } from './linkMarkUtils'
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
  const expectedHref = storedHrefOf(opts)
  return {
    mode: 'edit',
    editor: opts.editor,
    initialHref: opts.link.getAttribute('href') ?? '',
    initialText: getHyperlinkDisplayText(opts.editor, {
      nodePos: opts.nodePos,
      link: opts.link,
      markName: opts.markName
    }),
    validate: opts.validate,
    defaultSuggestionsState: 'collapsed',
    onApply: ({ href, text }) => {
      const applied = applyEdit({ ...opts, expectedHref }, { href, text })
      if (applied) dismiss(opts.editor)
      return applied
    },
    onBack: () => handleEditBack(opts),
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
