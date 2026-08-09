import { getDefaultController } from '../floating-popover'
import type { CreateHyperlinkOptions } from '../hyperlink'
import { createHTMLElement, validateURL } from '../utils'
import { Link } from '../utils/icons'

type HyperlinkElements = {
  root: HTMLElement
  form: HTMLFormElement
  input: HTMLInputElement
  button: HTMLButtonElement
  inputsWrapper: HTMLElement
  errorMessage: HTMLElement
}

const createHyperlinkElements = (prefillHref: string): HyperlinkElements => {
  const root = createHTMLElement('div', { className: 'hyperlink-create-popover' })
  const buttonsWrapper = createHTMLElement('div', { className: 'buttons-wrapper' })
  const inputsWrapper = createHTMLElement('div', { className: 'inputs-wrapper' })
  const form = createHTMLElement('form', {})

  const input = createHTMLElement('input', {
    type: 'text',
    inputMode: 'url',
    name: 'hyperlink-url',
    placeholder: 'https://example.com',
    autocomplete: 'new-password',
    spellcheck: false,
    value: prefillHref
  })

  const button = createHTMLElement('button', {
    type: 'submit',
    textContent: 'Apply',
    disabled: prefillHref.trim().length === 0
  })

  const errorMessage = createHTMLElement('div', {
    className: 'error-message',
    textContent: 'Please enter a valid URL'
  })

  const searchIcon = createHTMLElement('div', {
    className: 'search-icon',
    innerHTML: Link({ size: 24 })
  })

  inputsWrapper.append(searchIcon, input, errorMessage)
  buttonsWrapper.append(button)
  form.append(inputsWrapper, buttonsWrapper)
  root.append(form)

  return { root, form, input, button, inputsWrapper, errorMessage }
}

const setupEventListeners = (elements: HyperlinkElements, options: CreateHyperlinkOptions) => {
  const { form, input, button, inputsWrapper, errorMessage } = elements
  const { editor } = options

  const showError = () => {
    inputsWrapper.classList.add('error')
    errorMessage.classList.add('show')
  }

  const hideError = () => {
    inputsWrapper.classList.remove('error')
    errorMessage.classList.remove('show')
  }

  const updateButtonState = () => {
    const hasValue = input.value.trim().length > 0
    button.disabled = !hasValue
    if (hasValue) hideError()
  }

  input.addEventListener('input', updateButtonState)
  input.addEventListener('paste', () => setTimeout(updateButtonState, 0))
  inputsWrapper.addEventListener('click', () => input.focus())

  input.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      getDefaultController().close()
      editor.commands.focus()
    }
  })

  form.addEventListener('submit', (event: Event) => {
    event.preventDefault()
    if (button.disabled) return

    const url = input.value.trim()
    // Pre-submit UX gate: shape + user `validate` only. The full XSS +
    // `isAllowedUri` policy runs inside `setHyperlink`; on rejection the
    // command returns `false` and the popover stays open for correction.
    if (!validateURL(url, { customValidator: options.validate })) {
      showError()
      return
    }

    // Gate before the chain: `chain().run()` dispatches its `tr` even when a
    // command returns false, so a rejected href must not reach the insert.
    if (!editor.can().setHyperlink({ href: url })) {
      showError()
      return
    }

    // Delegate to the canonical command — it normalizes, runs the composed
    // gate, and stamps `PREVENT_AUTOLINK_META`, so policy changes flow here.
    const chain = editor.chain().setHyperlink({ href: url })
    // With nothing selected the mark would only reach `storedMarks` and the
    // document would not change, so give the link its own text.
    if (editor.state.selection.empty) chain.insertContent({ type: 'text', text: url })
    if (!chain.run()) {
      showError()
      return
    }
    getDefaultController().close()
    editor.commands.focus()
  })
}

export default function createHyperlinkPopover(options: CreateHyperlinkOptions): HTMLElement {
  const elements = createHyperlinkElements(options.attributes?.href ?? '')
  setupEventListeners(elements, options)
  return elements.root
}
