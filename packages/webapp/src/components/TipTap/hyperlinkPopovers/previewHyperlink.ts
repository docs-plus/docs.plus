import {
  Copy,
  copyToClipboard,
  createHTMLElement,
  editHyperlinkPopover,
  getSpecialUrlInfo,
  hideCurrentToolbar,
  LinkOff,
  Pencil,
  updateCurrentToolbarPosition
} from '@docs.plus/extension-hyperlink'
import { APPLY_FILTER, CHAT_OPEN } from '@services/eventsHub'
import { Editor } from '@tiptap/core'
import { EditorView } from '@tiptap/pm/view'
import { scrollToHeading } from '@utils/index'
import PubSub from 'pubsub-js'

import * as Icons from './iconList'

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
  attrs: Record<string, any>
}

interface MetadataResponse {
  title: string
  image?: string
  icon?: string
  success: true
}

interface ErrorResponse {
  success: false
  message: string
}

type ApiResponse = MetadataResponse | ErrorResponse

const hrefEventHandller = (href: string) => (event: MouseEvent) => {
  event.preventDefault()
  const newUrl = new URL(href)
  const slugs = location.pathname.split('/').slice(1)

  const headingId = newUrl.searchParams.get('id')
  const isSameDoc = newUrl.pathname.startsWith(`/${slugs[0]}`)
  const newUrlSlugs = newUrl.pathname.split('/').slice(1)
  const chatroomId = newUrl.searchParams.get('chatroom')
  const act = newUrl.searchParams.get('act')
  const messageId = newUrl.searchParams.get('m_id')
  const channelId = newUrl.searchParams.get('c_id')

  // if the new url belong to the current document
  if (isSameDoc) {
    // if there are more than one slug, it means it is a filter, so apply filter
    if (newUrlSlugs.length > 1) {
      hideCurrentToolbar()
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

    if (act === 'ch' && messageId && channelId) {
      hideCurrentToolbar()

      PubSub.publish(CHAT_OPEN, {
        headingId: channelId,
        scroll2Heading: true,
        fetchMsgsFromId: messageId
      })
      return true
    }
  }

  return window.open(href, '_blank')
}

// Create SVG icon element
const createSvgIcon = (iconName: string, className: string = ''): HTMLElement => {
  // Get the icon function from our iconList
  const iconFunction = (Icons as any)[iconName]

  if (iconFunction && typeof iconFunction === 'function') {
    const iconContainer = createHTMLElement('div', {
      className: `svg-icon-container ${className}`,
      innerHTML: iconFunction({ size: 20 })
    })
    return iconContainer
  }

  // Fallback to a default icon if the specific icon is not found
  const fallbackContainer = createHTMLElement('div', {
    className: `svg-icon-container ${className}`,
    innerHTML: `<div class="icon-fallback">${iconName.substring(0, 2).toUpperCase()}</div>`
  })
  return fallbackContainer
}

const createMetadataContent = (data: MetadataResponse | null, href: string): HTMLElement => {
  const specialInfo = getSpecialUrlInfo(href)
  let iconElement: HTMLElement | null = null

  if (specialInfo) {
    // Add SVG icon with category-specific styling
    iconElement = createSvgIcon(
      specialInfo.icon,
      `metadata-icon-special icon-${specialInfo.category}`
    )
  }

  const container = createHTMLElement('div', {
    className: `metadata-content ${specialInfo ? 'metadata-content-special' : ''}`
  })

  const titleLink = createHTMLElement('a', {
    target: '_blank',
    rel: 'noreferrer',
    href,
    innerText: data?.title || href,
    className: 'metadata-title'
  }) as HTMLAnchorElement

  titleLink.addEventListener('click', hrefEventHandller(href))

  container.append(titleLink)

  if (iconElement) container.prepend(iconElement)

  // Prefer icon over image for compact display, fallback to image
  const imageUrl = data?.icon || data?.image
  if (imageUrl) {
    const img = createHTMLElement('img', {
      src: imageUrl,
      alt: data.title,
      className: 'metadata-image',
      onerror: function (this: HTMLImageElement) {
        this.style.display = 'none'
      }
    }) as HTMLImageElement
    if (iconElement) container.removeChild(iconElement)
    container.prepend(img)
  }

  return container
}

const fetchMetadata = async (
  href: string,
  metadataContainer: HTMLDivElement,
  editor: Editor,
  _nodePos: number
): Promise<void> => {
  const defaultContent = createMetadataContent(null, href)
  metadataContainer.appendChild(defaultContent)

  try {
    const response = await fetch('/api/metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: href })
    })

    if (!response.ok) {
      console.error('Metadata API error:', response.statusText)
      return
    }

    const data: ApiResponse = await response.json()

    if (data.success) {
      metadataContainer.removeChild(defaultContent)
      const content = createMetadataContent(data, href)
      metadataContainer.appendChild(content)

      editor
        .chain()
        .focus()
        .extendMarkRange('hyperlink')
        .updateAttributes('hyperlink', {
          title: data.title,
          image: data.image
        })
        .run()

      const { from } = editor.state.selection
      const { left: x, top: y } = editor.view.coordsAtPos(from)
      let el = document.elementFromPoint(x, y)
      el = el?.closest('a[href]') as HTMLElement | null
      if (el) updateCurrentToolbarPosition(el as HTMLElement)
    } else {
      console.error('Metadata API error:', data.message)
    }
  } catch (error) {
    console.error('Error fetching metadata:', error)
  }
}

export default function previewHyperlink(options: HyperlinkModalOptions) {
  const { link, editor, nodePos, node: _node, attrs } = options
  const href = link.href

  const hyperlinkLinkModal = createHTMLElement('div', { className: 'hyperlinkPreviewPopover' })
  const removeButton = createHTMLElement('button', { className: 'remove', innerHTML: LinkOff() })
  const copyButton = createHTMLElement('button', { className: 'copy', innerHTML: Copy() })
  const editButton = createHTMLElement('button', { className: 'edit', innerHTML: Pencil() })
  const metadataContainer = createHTMLElement('div', { className: 'metadata' })

  // Check if metadata already exists in node attributes
  const existingTitle = attrs?.title
  const existingImage = attrs?.image

  if (existingTitle) {
    // Use existing metadata
    const cachedMetadata: MetadataResponse = {
      title: existingTitle,
      image: existingImage,
      success: true
    }
    const content = createMetadataContent(cachedMetadata, href)
    metadataContainer.appendChild(content)
  } else {
    // Fetch metadata if not cached
    fetchMetadata(href, metadataContainer, editor, nodePos)
  }

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

  hyperlinkLinkModal.append(metadataContainer, copyButton, editButton, removeButton)

  return hyperlinkLinkModal
}
