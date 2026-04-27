import {
  buildPreviewOptionsFromAnchor,
  type CreateHyperlinkOptions,
  type EditHyperlinkOptions,
  getDefaultController,
  openPreviewHyperlink
} from '@docs.plus/extension-hyperlink'
import type { Editor } from '@tiptap/core'

import { applyCreate } from './commands/applyCreate'
import { applyEdit } from './commands/applyEdit'
import { setActivePopover } from './hyperlinkPopoverStore'
import type { ActivePopover } from './types'

/** Ask the extension's controller to hide; close() detaches the host and emits `idle`, the store subscriber clears `active`, the portal unmounts. */
const dismiss = (editor: Editor) => {
  getDefaultController().close()
  if (!editor.isDestroyed) editor.commands.focus()
}

/** Caller `onBack` wins; otherwise rebuild the preview popover from the live `<a>` and hand back. */
const handleEditBack = (opts: EditHyperlinkOptions): void => {
  if (opts.onBack) {
    opts.onBack()
    return
  }
  openPreviewHyperlink(
    opts.editor,
    buildPreviewOptionsFromAnchor({
      editor: opts.editor,
      link: opts.link,
      validate: opts.validate,
      isAllowedUri: opts.isAllowedUri
    })
  )
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

const buildEditProps = (opts: EditHyperlinkOptions): ActivePopover['props'] => ({
  mode: 'edit',
  editor: opts.editor,
  initialHref: opts.link.getAttribute('href') ?? '',
  // `innerText` is browser-only; `textContent` is the JSDom-safe fallback.
  initialText: opts.link.innerText ?? opts.link.textContent ?? '',
  validate: opts.validate,
  defaultSuggestionsState: 'collapsed',
  onApply: ({ href, text }) => {
    const applied = applyEdit(opts, { href, text })
    if (applied) dismiss(opts.editor)
    return applied
  },
  onBack: () => handleEditBack(opts),
  onClose: () => dismiss(opts.editor)
})

/** Desktop adapter for `popovers.createHyperlink`: empty host registered in the bus and returned to the extension's floating controller for positioning. */
export function createHyperlinkDesktop(opts: CreateHyperlinkOptions): HTMLElement {
  const host = buildHost('hyperlink-create-popover')
  setActivePopover({ kind: 'create', host, props: buildCreateProps(opts) })
  return host
}

/** Mirror of `createHyperlinkDesktop` for the edit slot. */
export function editHyperlinkDesktop(opts: EditHyperlinkOptions): HTMLElement {
  const host = buildHost('hyperlink-edit-popover')
  setActivePopover({ kind: 'edit', host, props: buildEditProps(opts) })
  return host
}
