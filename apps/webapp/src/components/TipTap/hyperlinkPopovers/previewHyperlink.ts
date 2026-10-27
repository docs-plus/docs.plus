import { Icons } from '@components/icons/registry'
import * as toast from '@components/toast'
import {
  copyToClipboard,
  createHTMLElement,
  getDefaultController,
  openEditHyperlink,
  type PreviewHyperlinkOptions
} from '@docs.plus/extension-hyperlink'
import { useSheetStore, useStore } from '@stores'
import type { Editor } from '@tiptap/core'
import { lucideSvgString } from '@utils/lucideSvgString'
import { COPY_FADE_HOLD_MS, prefersReducedMotion } from '@utils/motion'

import { classifyInternalDocumentLink } from './internalDocumentLink'
import {
  createInternalLinkChip,
  observeDetachment,
  type PreviewContext,
  renderMetadataInto
} from './previewShared'

const KEYBOARD_DISMISS_DELAY_MS = 50

/**
 * Exists for edit-mode link taps. iOS releases the keyboard only when the
 * focused element blurs AND no selection range is left in the contenteditable. A
 * synchronous blur is flaky against ProseMirror's same-tick selection work.
 * `activeElement` is blurred too — the tapped `<a>` can hold focus.
 */
export const dismissSoftKeyboard = (editor: Editor): void => {
  const { to } = editor.state.selection
  editor.chain().setTextSelection(to).run()

  setTimeout(() => {
    if (editor.isDestroyed) return
    const active = document.activeElement as HTMLElement | null
    if (active && editor.view.dom.contains(active) && active !== editor.view.dom) {
      active.blur()
    }
    editor.view.dom.blur()
  }, KEYBOARD_DISMISS_DELAY_MS)
}

/**
 * Mobile opens the React `linkPreview` sheet and returns `null`. The extension's
 * clickHandler reads `null` as "no popover, just hide the toolbar". That bypass
 * lets the sheet render through the app's own sheet pipeline. The sheet never
 * reaches the floating-popover machinery.
 */
export default function previewHyperlink(options: PreviewHyperlinkOptions): HTMLElement | null {
  const { link, editor, nodePos, attrs } = options
  const href = attrs.href ?? link.getAttribute('href') ?? ''
  const isMobile = useStore.getState().settings.editor.isMobile ?? false

  if (isMobile) {
    useSheetStore.getState().openSheet('linkPreview', {
      href,
      editor,
      nodePos,
      isAllowedUri: options.isAllowedUri
    })
    dismissSoftKeyboard(editor)
    return null
  }

  return buildAndObserveDesktopPopover(options, href)
}

/**
 * No `onBack` is passed to the edit form: its Back runs `handleEditBack`, which rebuilds
 * this preview from the live `<a>`.
 */
const buildAndObserveDesktopPopover = (
  options: PreviewHyperlinkOptions,
  href: string
): HTMLElement => {
  const controller = new AbortController()
  const ctx: PreviewContext = { href, signal: controller.signal }
  const element = buildDesktopPopover(ctx, options)

  observeDetachment(element, () => controller.abort())

  return element
}

/**
 * Keep the `.hyperlink-preview-popover` DOM/class contract intact — the
 * existing CSS and Cypress specs both select against it.
 */
const buildDesktopPopover = (
  ctx: PreviewContext,
  options: PreviewHyperlinkOptions
): HTMLElement => {
  const { href } = ctx
  const { link, editor, nodePos, validate, isAllowedUri } = options

  const popover = createHTMLElement('div', { className: 'hyperlink-preview-popover' })
  const copyButton = createHTMLElement('button', {
    className: 'copy',
    title: 'Copy link',
    ariaLabel: 'Copy link',
    innerHTML: `<span class="swap" aria-hidden><span class="swap-on text-success">${lucideSvgString(Icons.check, 18)}</span><span class="swap-off">${lucideSvgString(Icons.copy, 18)}</span></span>`
  })
  const editButton = createHTMLElement('button', {
    className: 'edit',
    title: 'Edit link',
    ariaLabel: 'Edit link',
    innerHTML: lucideSvgString(Icons.pencil, 18)
  })
  const removeButton = createHTMLElement('button', {
    className: 'remove',
    title: 'Remove link',
    ariaLabel: 'Remove link',
    innerHTML: lucideSvgString(Icons.unlink, 18)
  })

  copyButton.addEventListener('click', () => {
    copyToClipboard(href, (success) => {
      if (ctx.signal.aborted) return
      if (!success) {
        toast.Error('Failed to copy to clipboard')
        return
      }
      copyButton.querySelector('.swap')?.classList.add('swap-active')
      copyButton.setAttribute('aria-label', 'Copied!')
      copyButton.title = 'Copied!'
      if (prefersReducedMotion()) {
        getDefaultController().close()
        return
      }
      const timer = window.setTimeout(() => {
        if (ctx.signal.aborted) return
        getDefaultController().close()
      }, COPY_FADE_HOLD_MS)
      ctx.signal.addEventListener('abort', () => window.clearTimeout(timer), { once: true })
    })
  })

  editButton.addEventListener('click', () => {
    openEditHyperlink({ editor, link, validate, isAllowedUri, nodePos })
  })

  removeButton.addEventListener('click', () => {
    getDefaultController().close()
    editor.chain().focus().unsetHyperlink().run()
  })

  // Edit and Remove write to the document, so a read-only reader must not be
  // offered them. Same gate the media toolbar already uses (mediaResizeControls).
  const editControls = editor.view.editable ? [editButton, removeButton] : []

  // Internal (same-document) links render a named destination chip and run
  // in place; no external metadata fetch. Copy still yields the canonical URL.
  const internalLink = classifyInternalDocumentLink(href, window.location.pathname)
  if (internalLink) {
    popover.append(createInternalLinkChip(internalLink, editor), copyButton, ...editControls)
    return popover
  }

  const metadataContainer = createHTMLElement('div', { className: 'metadata' })
  renderMetadataInto(metadataContainer, ctx)
  popover.append(metadataContainer, copyButton, ...editControls)
  return popover
}
