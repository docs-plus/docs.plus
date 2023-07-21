import { Editor } from '@tiptap/core'
import { EditorView } from '@tiptap/pm/view'
import { editeHyperlinkHandler } from './editeHyperlink'
import { Copy, LinkSlash, Pencil } from './icons'
import { Tooltip } from '@docs.plus/extension-hyperlink'

type HyperlinkModalOptions = {
  editor: Editor
  validate?: (url: string) => boolean
  view: EditorView
  link: HTMLAnchorElement
  node?: any
  nodePos: number
  tippy: Tooltip
}

export default function previewHyperlink(options: HyperlinkModalOptions) {
  const href = options.link.href

  const hyperlinkLinkModal = document.createElement('div')
  const removeButton = document.createElement('button')
  const copyButton = document.createElement('button')
  const editButton = document.createElement('button')

  const newBubble = document.createElement('div')
  newBubble.classList.add('metadata')

  const hrefTitle = document.createElement('a')
  hrefTitle.setAttribute('target', '_blank')
  hrefTitle.setAttribute('rel', 'noreferrer')
  hrefTitle.setAttribute('href', href)
  hrefTitle.innerText = href

  newBubble.append(hrefTitle)

  fetch('/api/metadata', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: href })
  })
    .then((response) => response.json())
    .then((data) => {
      // Create a new bubble with the title
      hrefTitle.setAttribute('href', href)

      hrefTitle.innerText = data.title || data['og:title'] || href
      newBubble.replaceChildren(hrefTitle)

      // Create an image element if image exists in metadata
      if (data.icon || data.image || data['og:image']) {
        const img = document.createElement('img')
        img.src = data.icon || data.image || data['og:image']
        img.alt = data.title || data['og:title'] || 'hyperlink image'
        newBubble.appendChild(img)
      }
    })
    .catch((error) => {
      console.error('Error fetching metadata:', error)
    })

  hyperlinkLinkModal.classList.add('hyperlinkLinkModal')

  removeButton.classList.add('remove')
  removeButton.innerHTML = LinkSlash()

  editButton.classList.add('edit')
  editButton.innerHTML = Pencil()

  copyButton.classList.add('copy')
  copyButton.innerHTML = Copy()

  removeButton.addEventListener('click', () => {
    options.tippy.hide()
    return options.editor.chain().focus().unsetHyperlink().run()
  })

  editButton.addEventListener('click', () => editeHyperlinkHandler({ ...options, hyperlinkLinkModal }))

  copyButton.addEventListener('click', () => {
    options.tippy.hide()
    navigator.clipboard.writeText(href)
  })

  hyperlinkLinkModal.append(newBubble, copyButton, editButton, removeButton)

  return hyperlinkLinkModal
}
