import { Icons } from '@components/icons/registry'
import * as toast from '@components/toast'
import {
  copyToClipboard,
  createHTMLElement,
  focusPreviewFromKeyboard,
  getDefaultController,
  openEditHyperlink,
  openPreviewPopover,
  type PreviewHyperlinkOptions
} from '@docs.plus/extension-hyperlink'
import { useSheetStore, useStore } from '@stores'
import type { Editor } from '@tiptap/core'
import { lucideSvgString } from '@utils/lucideSvgString'
import { COPY_FADE_HOLD_MS, prefersReducedMotion } from '@utils/motion'

import { navigateHref } from './hrefEventHandler'
import { describeDestination, linkDestination } from './internalDocumentLink'
import {
  createInternalLinkChip,
  createLinkChip,
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
  const element = buildDesktopPopover(ctx, options.editor, padEditControls(options))

  observeDetachment([element], () => controller.abort())

  return element
}

// `view.editable` mirrors the pad lock, and stays on in the composer, which has no lock.
const padEditControls = (options: PreviewHyperlinkOptions): HTMLElement[] => {
  const { link, editor, nodePos, validate, isAllowedUri } = options
  if (!editor.view.editable) return []

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

  editButton.addEventListener('click', () => {
    openEditHyperlink({ editor, link, validate, isAllowedUri, nodePos })
  })

  removeButton.addEventListener('click', () => {
    getDefaultController().close()
    editor.chain().focus().unsetHyperlink().run()
  })

  return [editButton, removeButton]
}

/**
 * Keep the `.hyperlink-preview-popover` DOM/class contract intact — the
 * existing CSS and Cypress specs both select against it. `editor` only names
 * same-pad headings, so a link outside the pad passes the pad editor or `null`.
 */
const buildDesktopPopover = (
  ctx: PreviewContext,
  editor: Editor | null,
  editControls: HTMLElement[]
): HTMLElement => {
  const { href } = ctx

  const popover = createHTMLElement('div', { className: 'hyperlink-preview-popover' })
  const copyButton = createHTMLElement('button', {
    className: 'copy',
    title: 'Copy link',
    ariaLabel: 'Copy link',
    innerHTML: `<span class="swap" aria-hidden><span class="swap-on text-success">${lucideSvgString(Icons.check, 18)}</span><span class="swap-off">${lucideSvgString(Icons.copy, 18)}</span></span>`
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

  // Internal (same-document) links render a named destination chip and run
  // in place; no external metadata fetch. Copy still yields the canonical URL.
  // `/new` gets the same chip; its action opens a new tab.
  const destination = linkDestination(href)
  const descriptor = describeDestination(destination, editor)
  if (!descriptor) {
    const metadataContainer = createHTMLElement('div', { className: 'metadata' })
    renderMetadataInto(metadataContainer, ctx)
    popover.append(metadataContainer, copyButton, ...editControls)
    return popover
  }

  const link = destination.kind === 'here' ? destination.link : null
  // A chip is an action, so it closes the preview first, as `runInternalDocumentLink` does.
  const chip = link
    ? createInternalLinkChip(link, descriptor)
    : createLinkChip(descriptor, () => {
        getDefaultController().close()
        navigateHref(href)
      })
  if (link?.kind !== 'filter') {
    popover.append(chip, copyButton, ...editControls)
    return popover
  }

  // The pills take the full width, so the actions move to a footer row (C6).
  popover.classList.add('hyperlink-preview-popover--column')
  const footer = createHTMLElement('div', { className: 'hyperlink-preview-footer' })
  footer.append(
    createHTMLElement('span', { className: 'footer-label', textContent: descriptor.sublabel }),
    copyButton,
    ...editControls
  )
  popover.append(chip, footer)
  return popover
}

/**
 * The pad preview for a link outside any editor, such as a posted chat message.
 * It has no mark, so it shows no Edit or Remove. Phone: the `linkPreview` sheet.
 */
export function previewLinkOutsideEditor(
  anchor: HTMLAnchorElement,
  href: string,
  fromKeyboard: boolean
): void {
  const { isMobile, instance } = useStore.getState().settings.editor
  const padEditor = instance ?? null
  if (isMobile) {
    useSheetStore.getState().openSheet('linkPreview', { href, editor: padEditor })
    return
  }

  const controller = new AbortController()
  const content = buildDesktopPopover({ href, signal: controller.signal }, padEditor, [])
  const popover = openPreviewPopover(anchor, content)

  // No mark `onDestroy` here: a list row that unmounts, or an edit echo, takes the anchor.
  observeDetachment([popover.element, anchor], () => {
    controller.abort()
    const popovers = getDefaultController()
    const state = popovers.getState()
    if (state.kind === 'mounted' && state.element === popover.element) popovers.close()
  })

  if (fromKeyboard) {
    focusPreviewFromKeyboard(() => {
      if (anchor.isConnected) anchor.focus({ preventScroll: true })
    })
  }
}
