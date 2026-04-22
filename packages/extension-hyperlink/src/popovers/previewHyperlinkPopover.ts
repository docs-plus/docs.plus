import { SAFE_WINDOW_FEATURES } from '../constants'
import { createFloatingToolbar, hideCurrentToolbar } from '../helpers/floatingToolbar'
import type { PreviewHyperlinkOptions } from '../hyperlink'
import { Copy, copyToClipboard, createHTMLElement, isSafeHref, LinkOff, Pencil } from '../utils'
import { logger } from '../utils/logger'
import editHyperlinkPopover from './editHyperlinkPopover'

function showPreviewToolbar(options: PreviewHyperlinkOptions): void {
  const content = previewHyperlinkPopover(options)
  const toolbar = createFloatingToolbar({
    referenceElement: options.link,
    content,
    placement: 'bottom',
    showArrow: true
  })
  toolbar.show()
}

export default function previewHyperlinkPopover(options: PreviewHyperlinkOptions): HTMLElement {
  const { link, editor } = options
  // Prefer the stored mark attribute over `link.href`. The DOM property
  // silently resolves relative hrefs against `document.baseURI`, which
  // turns a stored `google.com` into `http://<current-origin>/google.com`
  // in the preview — see normalizeHref for context. `getAttribute('href')`
  // returns the raw string as a fallback for callers that construct the
  // popover by hand (e.g. the XSS-guard spec) without supplying `attrs`.
  const href = options.attrs?.href ?? link.getAttribute('href') ?? ''
  // Mirror `renderHTML`'s defense-in-depth posture on the popover surface
  // too. The click handler short-circuits via `isSafeHref`, but a middle-
  // click on the rendered anchor would bypass it and trigger native
  // navigation. Blank the rendered `href` for unsafe schemes so the
  // browser cannot follow it under any input modality, while keeping
  // `innerText` honest so the user sees what was stored.
  const safeHref = isSafeHref(href) ? href : ''
  // Honor the user's composed `isAllowedUri` policy on the JS-driven
  // navigation path. Falls back to `isSafeHref` when the popover is
  // mounted outside the click-handler plugin (e.g. directly from a
  // BYO factory). Right-click still works natively because we never
  // intercept it.
  const isOpenable = options.isAllowedUri ?? isSafeHref

  const root = createHTMLElement('div', { className: 'hyperlink-preview-popover' })
  const removeButton = createHTMLElement('button', { className: 'remove', innerHTML: LinkOff() })
  const copyButton = createHTMLElement('button', { className: 'copy', innerHTML: Copy() })
  const editButton = createHTMLElement('button', { className: 'edit', innerHTML: Pencil() })

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
    hideCurrentToolbar()
    editor.chain().focus().unsetHyperlink().run()
  })

  editButton.addEventListener('click', () => {
    editHyperlinkPopover({
      ...options,
      onBack: () => showPreviewToolbar(options)
    })
  })

  copyButton.addEventListener('click', () => {
    copyToClipboard(href, (success) => {
      if (success) hideCurrentToolbar()
      else logger.error('previewHyperlink: copy to clipboard failed')
    })
  })

  root.append(hrefAnchor, copyButton, editButton, removeButton)
  return root
}
