import { Icons } from '@components/icons/registry'
import {
  copyToClipboard,
  createHTMLElement,
  getDefaultController,
  openEditHyperlink,
  type PreviewHyperlinkOptions
} from '@docs.plus/extension-hyperlink'
import { useSheetStore, useStore } from '@stores'
import type { Editor } from '@tiptap/core'

import { classifyInternalDocumentLink } from './internalDocumentLink'
import {
  createInternalLinkChip,
  observeDetachment,
  type PreviewContext,
  renderIconMarkup,
  renderMetadataInto
} from './previewShared'

/** Shared iOS keyboard dismiss / refocus cadence (clipboard, preview sheet, composer link dialog). */
export const KEYBOARD_DISMISS_DELAY_MS = 50

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
      attrs,
      isAllowedUri: options.isAllowedUri
    })
    dismissSoftKeyboard(editor)
    return null
  }

  return buildAndObserveDesktopPopover(options)
}

/**
 * No `onBack` re-show wiring is needed: the prebuilt edit popover's Back
 * closes over its own options and re-opens the preview itself.
 */
const buildAndObserveDesktopPopover = (options: PreviewHyperlinkOptions): HTMLElement => {
  const { link, editor, nodePos, attrs } = options
  const href = attrs.href ?? link.getAttribute('href') ?? ''
  const controller = new AbortController()
  const ctx: PreviewContext = { href, editor, nodePos, attrs, signal: controller.signal }
  const built = buildDesktopPopover(ctx, options)

  // Flush the mark-attr write (L1 cache) only AFTER the popover detaches.
  // Writing while open would re-render the underlying `<a>` element and
  // floating-ui would hide the popover via the referenceHidden middleware.
  observeDetachment(built.element, () => {
    controller.abort()
    built.flush()
  })

  return built.element
}

/**
 * Keep the `.hyperlink-preview-popover` DOM/class contract intact — the
 * existing CSS and Cypress specs both select against it.
 */
const buildDesktopPopover = (
  ctx: PreviewContext,
  options: PreviewHyperlinkOptions
): { element: HTMLElement; flush: () => void } => {
  const { href, editor, nodePos } = ctx
  const { link, validate, isAllowedUri } = options

  const popover = createHTMLElement('div', { className: 'hyperlink-preview-popover' })
  const copyButton = createHTMLElement('button', {
    className: 'copy',
    title: 'Copy link',
    ariaLabel: 'Copy link',
    innerHTML: renderIconMarkup(Icons.copy, 18)
  })
  const editButton = createHTMLElement('button', {
    className: 'edit',
    title: 'Edit link',
    ariaLabel: 'Edit link',
    innerHTML: renderIconMarkup(Icons.pencil, 18)
  })
  const removeButton = createHTMLElement('button', {
    className: 'remove',
    title: 'Remove link',
    ariaLabel: 'Remove link',
    innerHTML: renderIconMarkup(Icons.unlink, 18)
  })

  copyButton.addEventListener('click', () => {
    copyToClipboard(href, (success) => {
      if (success) getDefaultController().close()
      else console.error('Failed to copy to clipboard')
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
    popover.classList.add('is-internal')
    popover.append(createInternalLinkChip(internalLink, editor), copyButton, ...editControls)
    return { element: popover, flush: () => {} }
  }

  const metadataContainer = createHTMLElement('div', { className: 'metadata' })
  const { flush } = renderMetadataInto(metadataContainer, ctx)
  popover.append(metadataContainer, copyButton, ...editControls)
  return { element: popover, flush }
}
