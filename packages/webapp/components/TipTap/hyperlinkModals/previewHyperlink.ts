// @ts-nocheck
import { Editor } from '@tiptap/core'
import { EditorView } from '@tiptap/pm/view'
import { editeHyperlinkHandler } from './editeHyperlink'
import { Copy, LinkSlash, Pencil } from './icons'
import { Tooltip } from '@docs.plus/extension-hyperlink'
import { copyToClipboard, scrollToHeading } from '@utils/index'
import PubSub from 'pubsub-js'
import { APPLY_FILTER, CHAT_OPEN } from '@services/eventsHub'

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

const hrefEventHandller = (href: string, tippy: Tooltip) => (event: MouseEvent) => {
  event.preventDefault()
  const newUrl = new URL(href)
  const slugs = location.pathname.split('/').slice(1)

  const headingId = newUrl.searchParams.get('id')
  const isSameDoc = newUrl.pathname.startsWith(`/${slugs[0]}`)
  const newUrlSlugs = newUrl.pathname.split('/').slice(1)
  const chatroomId = newUrl.searchParams.get('chatroom')

  // if the new url belong to the current document
  if (isSameDoc) {
    // if there are more than one slug, it means it is a filter, so apply filter
    if (newUrlSlugs.length > 1) {
      tippy.hide()
      // drop the first slug, which is the document name (e.g. /doc-name/slug1/slug2)
      PubSub.publish(APPLY_FILTER, { slugs: newUrlSlugs.slice(1), href })
      return true
    }

    // if it is a chatroom, open chatroom
    if (chatroomId) {
      PubSub.publish(CHAT_OPEN, { headingId: chatroomId, scroll2Heading: true })
      return true
    }

    // otherwise, scroll to heading
    if (headingId) {
      return scrollToHeading(headingId)
    }
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

  hrefTitle.addEventListener('click', hrefEventHandller(href, tippy))

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
