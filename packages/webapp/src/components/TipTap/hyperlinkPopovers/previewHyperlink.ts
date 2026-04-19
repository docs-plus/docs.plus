import {
  Copy,
  copyToClipboard,
  createHTMLElement,
  editHyperlinkPopover,
  hideCurrentToolbar,
  LinkOff,
  Pencil,
  type PreviewHyperlinkOptions
} from '@docs.plus/extension-hyperlink'
import { useSheetStore, useStore } from '@stores'
import type { Editor } from '@tiptap/core'

import { observeDetachment, type PreviewContext, renderMetadataInto } from './previewShared'

/**
 * Dismiss the iOS soft keyboard before the link preview sheet seats.
 *
 * Read-mode taps are handled at the source: `useEditableDocControl`
 * keeps `contenteditable="false"` after edit→read, so iOS never
 * focuses the editor on the tap and this call is a no-op.
 *
 * The case this exists for is **edit-mode taps** — the user is
 * actively typing (keyboard up, contenteditable focused) and taps a
 * link. iOS reliably releases the keyboard only when both the focused
 * element loses focus AND there is no active selection range inside
 * the contenteditable. We collapse the selection, then defer the blur
 * one tick (matches the `useClipboard.dismissMenuAndKeyboard` pattern
 * — synchronous blur is flaky on iOS against ProseMirror's same-tick
 * selection management). We also blur the actual `activeElement` if
 * focus landed on a descendant (e.g. the tapped `<a>`); blurring the
 * editor host alone wouldn't release a focused child.
 */
const KEYBOARD_DISMISS_DELAY_MS = 50

const dismissSoftKeyboard = (editor: Editor): void => {
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
 * Thin orchestrator for the webapp's hyperlink preview popover.
 *
 * - On desktop, builds the historical inline popover (metadata + copy /
 *   edit / remove icon buttons) anchored to the link by the extension's
 *   floating-toolbar wrapper.
 * - On mobile, opens the React `linkPreview` bottom sheet via the
 *   global sheet store and returns `null`. The Tiptap extension's
 *   click handler treats `null` as "no popover, just hide the toolbar"
 *   (see clickHandler.ts in @docs.plus/extension-hyperlink), so the
 *   floating-toolbar machinery is bypassed entirely on mobile and the
 *   sheet renders through the same react-modal-sheet pipeline as every
 *   other mobile sheet in the app.
 *
 * Desktop variant cancels its in-flight `fetchMetadata` request via
 * AbortController the moment the popover is detached (outside-click,
 * scroll-out, etc.), and defers the L1 mark-attr write until after
 * detachment to avoid the floating-ui referenceHidden race.
 */
export default function previewHyperlink(options: PreviewHyperlinkOptions): HTMLElement | null {
  const { link, editor, nodePos, attrs } = options
  const href = link.href
  const isMobile = useStore.getState().settings.editor.isMobile ?? false

  if (isMobile) {
    useSheetStore.getState().openSheet('linkPreview', { href, editor, nodePos, attrs })
    dismissSoftKeyboard(editor)
    return null
  }

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
 * Desktop popover: preserves the pre-refactor DOM/class contract so the
 * existing `.hyperlink-preview-popover` CSS and Cypress specs keep
 * working.
 */
const buildDesktopPopover = (
  ctx: PreviewContext,
  options: PreviewHyperlinkOptions
): { element: HTMLElement; flush: () => void } => {
  const { href, editor } = ctx
  const { link, view, linkCoords, validate } = options

  const popover = createHTMLElement('div', { className: 'hyperlink-preview-popover' })
  const metadataContainer = createHTMLElement('div', { className: 'metadata' })
  const copyButton = createHTMLElement('button', { className: 'copy', innerHTML: Copy() })
  const editButton = createHTMLElement('button', { className: 'edit', innerHTML: Pencil() })
  const removeButton = createHTMLElement('button', { className: 'remove', innerHTML: LinkOff() })

  const { flush } = renderMetadataInto(metadataContainer, ctx)

  copyButton.addEventListener('click', () => {
    copyToClipboard(href, (success) => {
      if (success) hideCurrentToolbar()
      else console.error('Failed to copy to clipboard')
    })
  })

  editButton.addEventListener('click', () => {
    editHyperlinkPopover({ editor, view, link, linkCoords, validate })
  })

  removeButton.addEventListener('click', () => {
    hideCurrentToolbar()
    editor.chain().focus().unsetHyperlink().run()
  })

  popover.append(metadataContainer, copyButton, editButton, removeButton)
  return { element: popover, flush }
}
