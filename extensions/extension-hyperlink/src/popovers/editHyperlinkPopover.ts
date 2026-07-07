import { HYPERLINK_MARK_NAME } from '../constants'
import { getDefaultController } from '../floating-popover'
import type { EditHyperlinkOptions } from '../hyperlink'
import { buildPreviewOptionsFromAnchor } from '../openers/buildPreviewOptionsFromAnchor'
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

  // Mirror the create popover: Escape dismisses AND hands focus back to
  // the editor (the shell's own Escape handler only hides the popover).
  form.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      getDefaultController().close()
      editor.commands.focus()
    }
  })

  // Back button — re-opens the preview popover for this popover's own
  // options. `onBack` is an opt-in escape hatch (e.g. mobile sheet).
  backButton.addEventListener('click', () => {
    if (options.onBack) {
      options.onBack()
      return
    }
    openPreviewHyperlink(
      buildPreviewOptionsFromAnchor({
        editor,
        link,
        validate,
        isAllowedUri: options.isAllowedUri,
        nodePos: options.nodePos,
        markName: options.markName
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

    // `editHyperlink` returns `false` on two paths: the URL fails the composed
    // XSS + `isAllowedUri` gate (inline error, popover stays open), or the mark
    // is gone at the stored selection (e.g. a collab peer removed the link) —
    // then there is nothing left to edit, so close instead of blaming the URL.
    const markName = options.markName ?? HYPERLINK_MARK_NAME
    const ok = editor
      .chain()
      .focus()
      .extendMarkRange(markName)
      .editHyperlink({ newURL: newHref, newText })
      .run()
    if (!ok) {
      if (!editor.isActive(markName)) {
        getDefaultController().close()
        return
      }
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
