import { Editor } from '@tiptap/core'
import { tippy } from '@docs.plus/extension-hyperlink'
import { find } from 'linkifyjs'

type setHyperlinkModalOptions = {
  editor: Editor
  validate?: (url: string) => boolean
  extentionName: string
  attributes: Record<string, any>
}

export default function setHyperlink(options: setHyperlinkModalOptions) {
  const { tippyModal } = tippy.init({ ...options, view: options.editor.view })

  const hyperlinkLinkModal = document.createElement('div')
  const buttonsWrapper = document.createElement('div')
  const inputsWrapper = document.createElement('div')

  hyperlinkLinkModal.classList.add('hyperlinkLinkModal')

  buttonsWrapper.classList.add('buttonsWrapper')
  inputsWrapper.classList.add('inputsWrapper')

  // create a form that contain url input and a button for submit
  const form = document.createElement('form')
  const input = document.createElement('input')
  const button = document.createElement('button')

  input.setAttribute('type', 'text')
  input.setAttribute('placeholder', 'https://example.com')
  button.setAttribute('type', 'submit')
  button.innerText = 'Submit'

  inputsWrapper.append(input)
  buttonsWrapper.append(button)
  form.append(inputsWrapper, buttonsWrapper)

  hyperlinkLinkModal.append(form)

  tippyModal.innerHTML = ''
  tippyModal.append(hyperlinkLinkModal)
  tippy.update(options.editor.view)

  setTimeout(() => {
    input.focus()
    input.style.outlineColor = ' #dadce0'
  })

  input.addEventListener('keydown', () => {
    input.style.outlineColor = ' #dadce0'
  })

  // event listenr for submit button
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const url = input.value

    if (!url) {
      input.style.outlineColor = 'red'
      return
    }

    const sanitizeURL = find(url)
      .filter((link) => link.isLink)
      .filter((link) => {
        if (options.validate) {
          return options.validate(link.value)
        }
        return true
      })
      .at(0)

    if (!sanitizeURL?.href) {
      input.style.outlineColor = 'red'
      return
    }

    setTimeout(() => {
      tippy.destroyTooltip()
    })

    return options.editor
      .chain()
      .setMark(options.extentionName, { href: sanitizeURL.href })
      .setMeta('preventautohyperlink', true)
      .run()
  })

  return tippyModal
}