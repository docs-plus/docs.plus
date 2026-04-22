import { Editor } from '@tiptap/core'

import { HYPERLINK_MARK_NAME } from '../constants'
import { createFloatingToolbar, hideCurrentToolbar } from '../helpers/floatingToolbar'
import { createHTMLElement, validateURL } from '../utils'
import { Link, Title } from '../utils/icons'

const TOOLBAR_SHOW_DELAY_MS = 100

export type EditHyperlinkPopoverOptions = {
  editor: Editor
  validate?: (url: string) => boolean
  link: HTMLAnchorElement
  onBack?: () => void
  markName?: string
}

/**
 * @deprecated Renamed to `EditHyperlinkPopoverOptions` to match the file
 * name and the rest of the popover-options naming (`PreviewHyperlinkOptions`,
 * `CreateHyperlinkOptions`). Will be removed in the next major.
 */
export type EditHyperlinkModalOptions = EditHyperlinkPopoverOptions

export default function editHyperlinkPopover(options: EditHyperlinkPopoverOptions): void {
  const { editor, link, validate } = options

  const form = createHTMLElement('form', { className: 'hyperlink-edit-popover' })
  const inputsWrapper = createHTMLElement('div', { className: 'inputs-wrapper' })
  const buttonsWrapper = createHTMLElement('div', { className: 'buttons-wrapper' })

  // Text input
  const textWrapper = createHTMLElement('div', { className: 'text-wrapper' })
  const titleIcon = createHTMLElement('div', {
    className: 'search-icon',
    innerHTML: Title({ size: 24 })
  })
  const linkTextInput = createHTMLElement('input', {
    type: 'text',
    value: link?.innerText || '',
    placeholder: 'Enter link text'
  })
  const textError = createHTMLElement('div', {
    className: 'error-message',
    textContent: 'Please enter link text'
  })

  // URL input
  const hrefWrapper = createHTMLElement('div', { className: 'href-wrapper' })
  const anchorIcon = createHTMLElement('div', {
    className: 'search-icon',
    innerHTML: Link({ size: 24 })
  })
  const hrefInput = createHTMLElement('input', {
    type: 'text',
    inputMode: 'url',
    value: link.href,
    placeholder: 'Enter URL',
    autocomplete: 'new-password',
    spellcheck: false
  })
  const hrefError = createHTMLElement('div', {
    className: 'error-message',
    textContent: 'Please enter a valid URL'
  })

  // Buttons
  const backButton = createHTMLElement('button', {
    type: 'button',
    textContent: 'Back',
    className: 'back-button'
  })
  const applyButton = createHTMLElement('button', {
    type: 'submit',
    textContent: 'Apply',
    className: 'apply-button'
  })

  const showError = (wrapper: HTMLElement, errorEl: HTMLElement) => {
    wrapper.classList.add('error')
    errorEl.classList.add('show')
  }

  const hideError = (wrapper: HTMLElement, errorEl: HTMLElement) => {
    wrapper.classList.remove('error')
    errorEl.classList.remove('show')
  }

  linkTextInput.addEventListener('input', () => hideError(textWrapper, textError))
  hrefInput.addEventListener('input', () => hideError(hrefWrapper, hrefError))
  backButton.addEventListener('click', () => {
    if (options.onBack) options.onBack()
  })

  form.addEventListener('submit', (e) => {
    e.preventDefault()

    const newText = linkTextInput.value.trim()
    const newHref = hrefInput.value.trim()
    let hasErrors = false

    if (!newText) {
      showError(textWrapper, textError)
      hasErrors = true
    }

    if (!validateURL(newHref, { customValidator: validate })) {
      showError(hrefWrapper, hrefError)
      hasErrors = true
    }

    if (hasErrors) return

    editor
      .chain()
      .focus()
      .extendMarkRange(options.markName ?? HYPERLINK_MARK_NAME)
      .editHyperlink({ newURL: newHref, newText })
      .run()

    hideCurrentToolbar()
  })

  // Assemble DOM
  textWrapper.append(titleIcon, linkTextInput, textError)
  hrefWrapper.append(anchorIcon, hrefInput, hrefError)
  inputsWrapper.append(textWrapper, hrefWrapper)
  buttonsWrapper.append(backButton, applyButton)
  form.append(inputsWrapper, buttonsWrapper)

  hideCurrentToolbar()

  // Use the live `<a>` DOM node — its `getBoundingClientRect()` is
  // recomputed by the browser on every call, so the popover follows
  // the link during scroll. Cached `linkCoords` (snapshotted at click
  // time in clickHandler) would freeze the toolbar at its viewport
  // position and let the link scroll out from under it.
  const toolbar = createFloatingToolbar({
    referenceElement: link,
    content: form,
    placement: 'bottom',
    showArrow: true,
    surface: 'edit',
    onShow: () => linkTextInput.focus()
  })

  setTimeout(() => toolbar.show(), TOOLBAR_SHOW_DELAY_MS)
}
