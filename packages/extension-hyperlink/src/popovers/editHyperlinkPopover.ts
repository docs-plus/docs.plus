import { Editor } from '@tiptap/core'
import { EditorView } from '@tiptap/pm/view'
import { createFloatingToolbar, hideCurrentToolbar } from '../helpers/floating-toolbar'
import { createHTMLElement, Anchor, Title, validateURL } from '../utils'

type EditHyperlinkModalOptions = {
  editor: Editor
  validate?: (url: string) => boolean
  view: EditorView
  link: HTMLAnchorElement
  hyperlinkPopover: HTMLElement
  linkCoords: {
    x: number
    y: number
    width: number
    height: number
  }
}

export default function editHyperlinkPopover(options: EditHyperlinkModalOptions) {
  const { editor, link, hyperlinkPopover, linkCoords, validate, view } = options

  // Create form elements
  const form = createHTMLElement('form', { className: 'hyperlinkEditPopover' })
  const inputsWrapper = createHTMLElement('div', { className: 'inputsWrapper' })
  const buttonsWrapper = createHTMLElement('div', { className: 'buttonsWrapper' })

  // Text input section
  const textWrapper = createHTMLElement('div', { className: 'textWrapper' })
  const titleIcon = createHTMLElement('div', {
    className: 'search-icon',
    innerHTML: Title({ size: 24, fill: '#e3e3e3' })
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

  // URL input section
  const hrefWrapper = createHTMLElement('div', { className: 'hrefWrapper' })
  const anchorIcon = createHTMLElement('div', {
    className: 'search-icon',
    innerHTML: Anchor({ size: 24, fill: '#e3e3e3' })
  })
  const hrefInput = createHTMLElement('input', {
    type: 'text',
    inputMode: 'url',
    value: link.href,
    placeholder: 'Enter URL',
    autocomplete: 'new-password',
    spellcheck: false,
    autocorrect: 'off' as any,
    autocapitalize: 'off' as any
  })
  const hrefError = createHTMLElement('div', {
    className: 'error-message',
    textContent: 'Please enter a valid URL'
  })

  // Buttons
  const backButton = createHTMLElement('button', {
    type: 'button',
    textContent: 'Back',
    className: 'backButton'
  })
  const applyButton = createHTMLElement('button', {
    type: 'submit',
    textContent: 'Apply',
    className: 'btn_applyModal'
  })

  // Validation helpers
  const validateURLWithOptions = (url: string): boolean => {
    return validateURL(url, { customValidator: validate })
  }

  const showError = (wrapper: HTMLElement, errorEl: HTMLElement) => {
    wrapper.classList.add('error')
    errorEl.classList.add('show')
  }

  const hideError = (wrapper: HTMLElement, errorEl: HTMLElement) => {
    wrapper.classList.remove('error')
    errorEl.classList.remove('show')
  }

  // Event listeners
  linkTextInput.addEventListener('input', () => hideError(textWrapper, textError))
  hrefInput.addEventListener('input', () => hideError(hrefWrapper, hrefError))
  backButton.addEventListener('click', () => link.click())

  form.addEventListener('submit', (e) => {
    e.preventDefault()

    const newText = linkTextInput.value.trim()
    const newHref = hrefInput.value.trim()
    let hasErrors = false

    if (!newText) {
      showError(textWrapper, textError)
      hasErrors = true
    }

    if (!validateURLWithOptions(newHref)) {
      showError(hrefWrapper, hrefError)
      hasErrors = true
    }

    if (hasErrors) return

    editor.chain().focus().extendMarkRange('hyperlink').editHyperlink({
      newURL: newHref,
      newText: newText
    })

    hideCurrentToolbar()
  })

  // Assemble DOM
  textWrapper.append(titleIcon, linkTextInput, textError)
  hrefWrapper.append(anchorIcon, hrefInput, hrefError)
  inputsWrapper.append(textWrapper, hrefWrapper)
  buttonsWrapper.append(backButton, applyButton)
  form.append(inputsWrapper, buttonsWrapper)

  // Show the popover
  hyperlinkPopover.innerHTML = ''
  hyperlinkPopover.appendChild(form)
  hideCurrentToolbar()

  const toolbar = createFloatingToolbar({
    coordinates: {
      x: linkCoords.x,
      y: linkCoords.y,
      width: linkCoords.width,
      height: linkCoords.height,
      contextElement: view.dom
    },
    content: form,
    placement: 'bottom',
    showArrow: true,
    enableKeyboardNav: true,
    onError: (error) => console.error('Hyperlink edit toolbar error:', error),
    onShow: () => linkTextInput.focus()
  })

  setTimeout(() => toolbar.show(), 100)
}
