import { Editor } from '@tiptap/core'
import { EditorView } from '@tiptap/pm/view'

import { hideCurrentToolbar } from '../helpers/floating-toolbar'
import { Copy, copyToClipboard, createHTMLElement, LinkOff, Pencil } from '../utils'
import editHyperlinkPopover from './editHyperlinkPopover'

type HyperlinkModalOptions = {
  editor: Editor
  validate?: (url: string) => boolean
  view: EditorView
  link: HTMLAnchorElement
  node?: any
  nodePos: number
  event: MouseEvent
  linkCoords: {
    x: number
    y: number
    width: number
    height: number
  }
}

export default function previewHyperlink(options: HyperlinkModalOptions) {
  const { link, editor } = options
  const href = link.href

  const hyperlinkLinkModal = createHTMLElement('div', { className: 'hyperlinkPreviewPopover' })
  const removeButton = createHTMLElement('button', { className: 'remove', innerHTML: LinkOff() })
  const copyButton = createHTMLElement('button', { className: 'copy', innerHTML: Copy() })
  const editButton = createHTMLElement('button', { className: 'edit', innerHTML: Pencil() })

  const hrefTitle = createHTMLElement('a', {
    target: '_blank',
    rel: 'noreferrer',
    href,
    innerText: href
  }) as HTMLAnchorElement

  hrefTitle.addEventListener('click', (event) => {
    event.preventDefault()
    window.open(href, '_blank')
  })

  removeButton.addEventListener('click', () => {
    hideCurrentToolbar()
    // @ts-ignore - unsetHyperlink is a valid command but TypeScript types aren't picking it up in Docker builds
    return editor.chain().focus().unsetHyperlink().run()
  })

  editButton.addEventListener('click', () => {
    editHyperlinkPopover({ ...options, hyperlinkPopover: hyperlinkLinkModal })
  })

  copyButton.addEventListener('click', () => {
    copyToClipboard(href, (success) => {
      if (success) hideCurrentToolbar()
      else console.error('Failed to copy to clipboard')
    })
  })

  hyperlinkLinkModal.append(hrefTitle, copyButton, editButton, removeButton)

  return hyperlinkLinkModal
}
