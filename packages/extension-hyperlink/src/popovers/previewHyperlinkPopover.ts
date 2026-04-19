import { createFloatingToolbar, hideCurrentToolbar } from '../helpers/floatingToolbar'
import type { PreviewHyperlinkOptions } from '../hyperlink'
import {
  Copy,
  copyToClipboard,
  createHTMLElement,
  DANGEROUS_SCHEME_RE,
  LinkOff,
  Pencil
} from '../utils'
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

  const root = createHTMLElement('div', { className: 'hyperlink-preview-popover' })
  const removeButton = createHTMLElement('button', { className: 'remove', innerHTML: LinkOff() })
  const copyButton = createHTMLElement('button', { className: 'copy', innerHTML: Copy() })
  const editButton = createHTMLElement('button', { className: 'edit', innerHTML: Pencil() })

  const hrefTitle = createHTMLElement('a', {
    target: '_blank',
    rel: 'noreferrer',
    href,
    innerText: href
  }) as HTMLAnchorElement

  hrefTitle.addEventListener('click', (event) => {
    event.preventDefault()
    if (!DANGEROUS_SCHEME_RE.test(href)) {
      window.open(href, '_blank')
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
      else console.error('Failed to copy to clipboard')
    })
  })

  root.append(hrefTitle, copyButton, editButton, removeButton)
  return root
}
