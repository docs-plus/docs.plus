import { HYPERLINK_MARK_NAME } from '../constants'
import { getDefaultController } from '../floating-popover'
import type { EditHyperlinkOptions } from '../hyperlink'
import { buildPreviewOptionsFromAnchor } from '../openers/buildPreviewOptionsFromAnchor'
import { consumeStashedEditOptions } from '../openers/openEditHyperlink'
import { openPreviewHyperlink } from '../openers/openPreviewHyperlink'
import { createHTMLElement, validateURL } from '../utils'
import { Link, Title } from '../utils/icons'

export default function editHyperlinkPopover(options: EditHyperlinkOptions): HTMLElement {
  const { editor, link, validate } = options

  const form = createHTMLElement('form', { className: 'hyperlink-edit-popover' })
  const inputsWrapper = createHTMLElement('div', { className: 'inputs-wrapper' })
  const buttonsWrapper = createHTMLElement('div', { className: 'buttons-wrapper' })

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

  const hrefWrapper = createHTMLElement('div', { className: 'href-wrapper' })
  const anchorIcon = createHTMLElement('div', {
    className: 'search-icon',
    innerHTML: Link({ size: 24 })
  })
  const hrefInput = createHTMLElement('input', {
    type: 'text',
    inputMode: 'url',
    value: link.getAttribute('href') ?? '',
    placeholder: 'Enter URL',
    autocomplete: 'new-password',
    spellcheck: false
  })
  const hrefError = createHTMLElement('div', {
    className: 'error-message',
    textContent: 'Please enter a valid URL'
  })

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

  // Back button — re-opens the preview popover via the stash that
  // `openEditHyperlink` set on entry. `onBack` is an opt-in escape
  // hatch; when neither path applies (e.g. host adopted the edit
  // popover by hand), just close.
  backButton.addEventListener('click', () => {
    if (options.onBack) {
      options.onBack()
      return
    }
    const stashed = consumeStashedEditOptions()
    if (!stashed) {
      getDefaultController().close()
      return
    }
    openPreviewHyperlink(
      stashed.editor,
      buildPreviewOptionsFromAnchor({
        editor: stashed.editor,
        link: stashed.opts.link,
        validate: stashed.opts.validate,
        isAllowedUri: stashed.opts.isAllowedUri,
        nodePos: stashed.opts.nodePos,
        markName: stashed.opts.markName
      })
    )
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

    // `editHyperlink` returns `false` when the URL fails the composed
    // XSS + `isAllowedUri` gate (input passed `validateURL` but not the
    // host policy — e.g. `https://blocked.example` under a custom
    // `isAllowedUri`). Surface the same inline error and keep the
    // popover open so the user can correct the href without losing
    // their typed text.
    const ok = editor
      .chain()
      .focus()
      .extendMarkRange(options.markName ?? HYPERLINK_MARK_NAME)
      .editHyperlink({ newURL: newHref, newText })
      .run()
    if (!ok) {
      showError(hrefWrapper, hrefError)
      return
    }

    getDefaultController().close()
  })

  textWrapper.append(titleIcon, linkTextInput, textError)
  hrefWrapper.append(anchorIcon, hrefInput, hrefError)
  inputsWrapper.append(textWrapper, hrefWrapper)
  buttonsWrapper.append(backButton, applyButton)
  form.append(inputsWrapper, buttonsWrapper)

  // Auto-focus the text input on first show. Caller (the opener) is
  // responsible for `popover.show()`; we don't know when that is here.
  queueMicrotask(() => linkTextInput.focus())

  return form
}
