import { Editor } from '@tiptap/core'
import { EditorView } from '@tiptap/pm/view'
import { editeHyperlinkHandler } from './editeHyperlink'
import { Copy, LinkSlash, Pencil } from './icons'
import { Tooltip } from '@docs.plus/extension-hyperlink'
import { copyToClipboard } from '@utils/index'

type HyperlinkModalOptions = {
  editor: Editor
  validate?: (url: string) => boolean // eslint-disable-line no-unused-vars
  view: EditorView
  link: HTMLAnchorElement
  node?: any
  nodePos: number
  tippy: Tooltip
  event: MouseEvent
}

const createHTMLElement = (type: string, props: any) => {
  const element = document.createElement(type)

  for (const prop in props) {
    // eslint-disable-next-line no-extra-semi
    ;(element as any)[prop] = props[prop]
  }

  return element
}

const fetchMetadata = (href: string, hrefTitle: HTMLAnchorElement, newBubble: HTMLDivElement) => {
  fetch('/api/metadata', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: href })
  })
    .then((response) => response.json())
    .then((data) => {
      hrefTitle.innerText = data.title || data['og:title'] || href
      newBubble.replaceChildren(hrefTitle)

      if (data.icon || data.image || data['og:image']) {
        const img = createHTMLElement('img', {
          src: data.icon || data.image || data['og:image'],
          alt: data.title || data['og:title'] || 'hyperlink image'
        })
        newBubble.appendChild(img)
      }
    })
    .catch((error) => {
      console.error('Error fetching metadata:', error)
    })
}

const hrefEventHandller = (href: string) => (event: MouseEvent) => {
  event.preventDefault()
  const newUrl = new URL(href)
  const slugs = newUrl.pathname.split('/').slice(1)

  if (newUrl.pathname.startsWith(`/${slugs[0]}`)) {
    return (window.location.href = href)
  }

  return window.open(href, '_blank')
}

export default function previewHyperlink(options: HyperlinkModalOptions) {
  const { link, tippy, editor } = options
  const href = link.href

  const hyperlinkLinkModal = createHTMLElement('div', { className: 'hyperlinkLinkModal' })
  const removeButton = createHTMLElement('button', { className: 'remove', innerHTML: LinkSlash() })
  const copyButton = createHTMLElement('button', { className: 'copy', innerHTML: Copy() })
  const editButton = createHTMLElement('button', { className: 'edit', innerHTML: Pencil() })

  const newBubble = createHTMLElement('div', { className: 'metadata' }) as HTMLDivElement

  const hrefTitle = createHTMLElement('a', {
    target: '_blank',
    rel: 'noreferrer',
    href,
    innerText: href
  }) as HTMLAnchorElement

  hrefTitle.addEventListener('click', hrefEventHandller(href))

  newBubble.append(hrefTitle)

  fetchMetadata(href, hrefTitle, newBubble)

  removeButton.addEventListener('click', () => {
    tippy.hide()
    return editor.chain().focus().unsetHyperlink().run()
  })

  editButton.addEventListener('click', () =>
    editeHyperlinkHandler({ ...options, hyperlinkLinkModal })
  )

  copyButton.addEventListener('click', () => {
    tippy.hide()
    copyToClipboard(href)
  })

  hyperlinkLinkModal.append(newBubble, copyButton, editButton, removeButton)

  return hyperlinkLinkModal
}
