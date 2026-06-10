import { SAFE_WINDOW_FEATURES } from '../constants'
import { getDefaultController } from '../floating-popover'
import type { PreviewHyperlinkOptions } from '../hyperlink'
import { openEditHyperlink } from '../openers/openEditHyperlink'
import { Copy, copyToClipboard, createHTMLElement, isSafeHref, LinkOff, Pencil } from '../utils'
import { logger } from '../utils/logger'

// Icon-only action button: explicit `type` (the popover lives outside any
// form, but defaults are surprising) plus matching title/aria-label.
const iconButton = (className: string, label: string, icon: string): HTMLButtonElement => {
  const button = createHTMLElement('button', {
    type: 'button',
    className,
    innerHTML: icon,
    title: label
  })
  button.setAttribute('aria-label', label)
  return button
}

export default function previewHyperlinkPopover(options: PreviewHyperlinkOptions): HTMLElement {
  const { link, editor } = options
  // `attrs.href` is the only gate-validated source — DOM `link.href`
  // resolves relative hrefs against `document.baseURI` (origin leak) and
  // `getAttribute` returns whatever raw value escaped validation.
  const href = options.attrs.href ?? ''
  // Blank unsafe schemes on render (mirrors `renderHTML`): a middle-click
  // on the rendered anchor would bypass the JS click guard otherwise.
  // `innerText` stays honest so the user sees what was stored.
  const safeHref = isSafeHref(href) ? href : ''
  // Composed `isAllowedUri` policy for JS-driven navigation; falls back to
  // `isSafeHref` when mounted outside the click-handler plugin (BYO factory).
  const isOpenable = options.isAllowedUri ?? isSafeHref

  const root = createHTMLElement('div', { className: 'hyperlink-preview-popover' })
  const removeButton = iconButton('remove', 'Remove link', LinkOff())
  const copyButton = iconButton('copy', 'Copy link', Copy())
  const editButton = iconButton('edit', 'Edit link', Pencil())

  // `noopener noreferrer` matches the Hyperlink default `HTMLAttributes`
  // and is the belt to the click-handler's braces — if JS ever fails to
  // attach (CSP, host strips listeners, factory throws), the browser's
  // default `target="_blank"` navigation still cannot reach `window.opener`.
  const hrefAnchor = createHTMLElement('a', {
    target: '_blank',
    rel: 'noopener noreferrer',
    href: safeHref,
    innerText: href
  }) as HTMLAnchorElement

  hrefAnchor.addEventListener('click', (event) => {
    event.preventDefault()
    if (safeHref && isOpenable(safeHref)) {
      window.open(safeHref, '_blank', SAFE_WINDOW_FEATURES)
    }
  })

  removeButton.addEventListener('click', () => {
    getDefaultController().close()
    editor.chain().focus().unsetHyperlink().run()
  })

  editButton.addEventListener('click', () => {
    // Route through the canonical opener so slot resolution stays in one
    // place. The prebuilt edit popover's Back closes over these options
    // and re-opens the preview itself, so no `onBack` override is needed.
    openEditHyperlink({
      editor,
      link,
      nodePos: options.nodePos,
      validate: options.validate,
      isAllowedUri: options.isAllowedUri
    })
  })

  copyButton.addEventListener('click', () => {
    copyToClipboard(href, (success) => {
      if (success) getDefaultController().close()
      else logger.error('previewHyperlink: copy to clipboard failed')
    })
  })

  root.append(hrefAnchor, copyButton, editButton, removeButton)
  return root
}
