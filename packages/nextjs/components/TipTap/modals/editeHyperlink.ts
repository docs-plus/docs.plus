import { Editor } from '@tiptap/core'
import { EditorView } from '@tiptap/pm/view'
import { roundArrow } from 'tippy.js'
import { find } from 'linkifyjs'
import { Tooltip } from '@docs.plus/extension-hyperlink'

type EditHyperlinkModalOptions = {
  editor: Editor
  validate?: (url: string) => boolean // eslint-disable-line no-unused-vars
  view: EditorView
  link: HTMLAnchorElement
  hyperlinkLinkModal: HTMLElement
  tippy: Tooltip
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

  hrefInput.addEventListener('keydown', () => {
    hrefInput.style.outlineColor = ' #dadce0'
  })

  hrefInput.addEventListener('keydown', () => {
    linkTextInput.style.outlineColor = ' #dadce0'
  })

  // Handle form submission
  form.addEventListener('submit', (e) => {
    e.preventDefault()

    const newLinkText = linkTextInput.value
    const newHref = hrefInput.value

    if (!newHref || !newLinkText) {
      if (!newHref) hrefInput.style.outlineColor = 'red'
      if (!newLinkText) linkTextInput.style.outlineColor = 'red'
      return
    }

    const sanitizeURL = find(newHref)
      .filter((link) => link.isLink)
      .filter((link) => {
        if (options.validate) {
          return options.validate(link.value as string)
        }
        return true
      })
      .at(0)

    if (!sanitizeURL?.href) {
      hrefInput.style.outlineColor = 'red'
      return
    }

    options.editor.chain().focus().extendMarkRange('hyperlink').editHyperlink({
      newURL: newHref,
      newText: newLinkText
    })

    options.tippy.hide()
  })

  // Show tooltip
  options.tippy.update(options.view, {
    arrow: roundArrow
  })

  setTimeout(() => linkTextInput.focus())
}
