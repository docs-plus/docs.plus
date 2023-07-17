import { Editor, Node } from '@tiptap/core'
import { EditorView } from '@tiptap/pm/view'
import { tippy } from '@docs.plus/extension-hyperlink'
import { roundArrow } from 'tippy.js'

type EditHyperlinkModalOptions = {
  editor: Editor
  validate?: (url: string) => boolean
  view: EditorView
  link: HTMLAnchorElement
  hyperlinkLinkModal: HTMLElement
}

export const editeHyperlinkHandler = (options: EditHyperlinkModalOptions) => {
  // Create the form
  const form = document.createElement('form')

  const buttonsWrapper = document.createElement('div')
  const inputsWrapper = document.createElement('div')

  const linkTextInput = document.createElement('input')
  const hrefInput = document.createElement('input')
  const applyButton = document.createElement('button')

  buttonsWrapper.classList.add('buttonsWrapper')
  inputsWrapper.classList.add('inputsWrapper')

  linkTextInput.type = 'text'
  linkTextInput.value = options.link?.innerText || ''
  linkTextInput.placeholder = 'Enter link text'

  hrefInput.type = 'text'
  hrefInput.value = options.link.href
  hrefInput.placeholder = 'Enter href'

  applyButton.type = 'submit'
  applyButton.classList.add('btn_applyModal')
  applyButton.innerText = 'Apply'

  buttonsWrapper.append(applyButton)
  inputsWrapper.append(linkTextInput, hrefInput)

  // Append to form
  form.append(inputsWrapper, buttonsWrapper)

  options.hyperlinkLinkModal.innerHTML = ''
  options.hyperlinkLinkModal.appendChild(form)

  // Handle form submission
  form.addEventListener('submit', (e) => {
    e.preventDefault()

    const newLinkText = linkTextInput.value
    const newHref = hrefInput.value

    options.editor.chain().focus().extendMarkRange('hyperlink').editHyperlink({
      newURL: newHref,
      newText: newLinkText
    })

    tippy.destroyTooltip()
  })

  // Show tooltip
  tippy.update(options.view, {
    arrow: roundArrow
  })

  setTimeout(() => linkTextInput.focus())
}
