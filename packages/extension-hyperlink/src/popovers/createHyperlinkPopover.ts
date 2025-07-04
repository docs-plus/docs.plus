import { Editor } from '@tiptap/core'
import { createFloatingToolbar, FloatingToolbarInstance } from '../helpers/floating-toolbar'
import { createHTMLElement, Anchor, validateURL } from '../utils'

type setHyperlinkModalOptions = {
  editor: Editor
  validate?: (url: string) => boolean
  extentionName: string
  attributes: Record<string, any>
}

type HyperlinkElements = {
  hyperlinkCreatePopover: HTMLElement
  form: HTMLFormElement
  input: HTMLInputElement
  button: HTMLButtonElement
  inputsWrapper: HTMLElement
  errorMessage: HTMLElement
}

// Helper: Create DOM elements
const createHyperlinkElements = (): HyperlinkElements | null => {
  try {
    const hyperlinkCreatePopover = createHTMLElement('div', {
      className: 'hyperlinkCreatePopover'
    })

    const buttonsWrapper = createHTMLElement('div', {
      className: 'buttonsWrapper'
    })

    const inputsWrapper = createHTMLElement('div', {
      className: 'inputsWrapper'
    })

    const form = createHTMLElement('form', {})

    const input = createHTMLElement('input', {
      type: 'text',
      inputMode: 'url',
      name: 'hyperlink-url',
      placeholder: 'https://example.com',
      autocomplete: 'new-password',
      spellcheck: false
    })

    const button = createHTMLElement('button', {
      type: 'submit',
      textContent: 'Apply',
      disabled: true
    })
    const errorMessage = createHTMLElement('div', {
      className: 'error-message',
      textContent: 'Please enter a valid URL'
    })

    // Create search icon using utility
    const searchIcon = createHTMLElement('div', {
      className: 'search-icon',
      innerHTML: Anchor({ size: 24, fill: '#e3e3e3' })
    })

    // Assemble DOM
    inputsWrapper.append(searchIcon, input, errorMessage)
    buttonsWrapper.append(button)
    form.append(inputsWrapper, buttonsWrapper)
    hyperlinkCreatePopover.append(form)

    return {
      hyperlinkCreatePopover,
      form,
      input,
      button,
      inputsWrapper,
      errorMessage
    }
  } catch (error) {
    console.error('Failed to create hyperlink elements:', error)
    return null
  }
}

// Helper: URL validation logic
const createValidationHelpers = (options: setHyperlinkModalOptions) => {
  const validateURLWithOptions = (url: string): boolean => {
    return validateURL(url, { customValidator: options.validate })
  }

  const showError = (inputsWrapper: HTMLElement, errorMessage: HTMLElement) => {
    inputsWrapper.classList.add('error')
    errorMessage.classList.add('show')
  }

  const hideError = (inputsWrapper: HTMLElement, errorMessage: HTMLElement) => {
    inputsWrapper.classList.remove('error')
    errorMessage.classList.remove('show')
  }

  return { validateURL: validateURLWithOptions, showError, hideError }
}

// Helper: Event listeners setup
const setupEventListeners = (
  elements: HyperlinkElements,
  options: setHyperlinkModalOptions,
  toolbar: FloatingToolbarInstance,
  helpers: ReturnType<typeof createValidationHelpers>
) => {
  const { form, input, button, inputsWrapper, errorMessage } = elements
  const { validateURL, showError, hideError } = helpers

  // Simple button state update
  const updateButtonState = () => {
    const hasValue = input.value.trim().length > 0
    button.disabled = !hasValue

    if (hasValue) {
      hideError(inputsWrapper, errorMessage)
    }
  }

  // Event listeners
  input.addEventListener('input', updateButtonState)
  input.addEventListener('paste', () => setTimeout(updateButtonState, 0))
  inputsWrapper.addEventListener('click', () => input.focus())

  input.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      toolbar.hide()
      options.editor.commands.focus()
    }
  })

  form.addEventListener('submit', (event: Event) => {
    event.preventDefault()

    if (button.disabled) return

    const url = input.value.trim()

    if (!validateURL(url)) {
      showError(inputsWrapper, errorMessage)
      return
    }

    toolbar.hide()

    options.editor
      .chain()
      .setMark(options.extentionName, { href: url })
      .setMeta('preventautohyperlink', true)
      .run()
  })
}

// Helper: Get selection coordinates
const getSelectionCoordinates = (editor: Editor) => {
  const { state, view } = editor
  const { from, to } = state.selection

  const start = view.coordsAtPos(from)
  const end = view.coordsAtPos(to)

  return { start, end, view }
}

// Main function
export default function createHyperlinkPopover(options: setHyperlinkModalOptions): void {
  // Get selection coordinates
  const { start, end, view } = getSelectionCoordinates(options.editor)

  // Create DOM elements
  const elements = createHyperlinkElements()
  if (!elements) return

  // Create toolbar
  const toolbar = createFloatingToolbar({
    coordinates: {
      x: start.left,
      y: start.top,
      width: end.left - start.left,
      height: end.bottom - start.top,
      contextElement: view.dom
    },
    content: elements.hyperlinkCreatePopover,
    placement: 'bottom',
    showArrow: true,
    enableKeyboardNav: true,
    onShow: () => {
      setTimeout(() => elements.input.focus(), 100)
    },
    onError: (error) => console.error('Toolbar error:', error)
  })

  // Create validation helpers
  const helpers = createValidationHelpers(options)

  // Setup event listeners
  setupEventListeners(elements, options, toolbar, helpers)

  // Show toolbar
  toolbar.show()
}
