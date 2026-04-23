import { SAFE_WINDOW_FEATURES } from '../constants'
import { getDefaultController } from '../floating-popover'
import type { PreviewHyperlinkOptions } from '../hyperlink'
import { openEditHyperlink } from '../openers/openEditHyperlink'
import { Copy, copyToClipboard, createHTMLElement, isSafeHref, LinkOff, Pencil } from '../utils'
import { logger } from '../utils/logger'

export default function previewHyperlinkPopover(options: PreviewHyperlinkOptions): HTMLElement {
  const { link, editor } = options
  // Read href from the validated mark attribute. The DOM `link.href`
  // property silently resolves relative hrefs against `document.baseURI`
  // (turning a stored `google.com` into `http://<origin>/google.com`),
  // and `getAttribute('href')` returns the raw stored value — both can
  // serve a `javascript:` href that escaped validation. `attrs.href`
  // is the only path that's been through the safety gate.
  const href = options.attrs.href ?? ''
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
    getDefaultController().close()
    editor.chain().focus().unsetHyperlink().run()
  })

  editButton.addEventListener('click', () => {
    // Route through the canonical opener so the slot resolution + stash
    // wiring stays in one place. The default Back behaviour
    // (`buildPreviewOptionsFromAnchor` → `openPreviewHyperlink`) is
    // exactly what `onBack` would have re-run, so no override is needed.
    openEditHyperlink(editor, { editor, link, validate: options.validate })
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
