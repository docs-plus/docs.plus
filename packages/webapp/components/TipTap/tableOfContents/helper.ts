import PubSub from 'pubsub-js'
import slugify from 'slugify'
import { TIPTAP_EVENTS, TIPTAP_NODES } from '@types'
import { Editor } from '@tiptap/react'
import { CHAT_OPEN } from '@services/eventsHub'

export const getOffsetTop = (element: any): number =>
  element ? element.offsetTop + getOffsetTop(element.offsetParent) : 0

export const getHeadingDetails = (id: string) => {
  const headingSection = document.querySelector(`.ProseMirror .heading[data-id="${id}"]`)
  const offsetTop = getOffsetTop(headingSection)
  return { headingSection, offsetTop }
}

export const toggleHeadingSection = (item: any) => {
  const itemElement = document.querySelector(`.toc__item[data-id="${item.id}"]`) as HTMLElement
  const btnFoldElement = itemElement.querySelector(`.btnFold`) as HTMLElement
  const childrenWrapperElement = itemElement.querySelector('.childrenWrapper')

  itemElement.classList.toggle('closed')
  btnFoldElement.classList.toggle('closed')
  btnFoldElement.classList.toggle('opened')
  childrenWrapperElement?.classList.toggle('hidden')

  // @ts-ignore
  PubSub.publish(TIPTAP_EVENTS.FOLD_AND_UNFOLD, { headingId: item.id, open: !item.open })
}

export const handelScroll2Title = ({
  workspaceId,
  title,
  openChatRoom
}: {
  workspaceId?: string
  title: string
  openChatRoom: boolean
}) => {
  document
    .querySelector(`.tiptap__editor.docy_editor .heading`)
    ?.scrollIntoView({ behavior: 'smooth' })

  if (!workspaceId) return

  const url = new URL(window.location.href)
  url.searchParams.set('h', slugify(title.toLowerCase().trim()))
  url.searchParams.set('id', workspaceId)
  window.history.replaceState({}, '', url)

  if (openChatRoom && workspaceId) {
    PubSub.publish(CHAT_OPEN, {
      headingId: workspaceId
    })
  }
}

export const handelScroll2Header = (
  e: any,
  editor: Editor,
  setActiveHeading: any,
  openChatRoom: boolean = false
) => {
  e.preventDefault()

  const isValidTarget =
    e.target.tagName === 'A' ||
    (e.target.tagName === 'SPAN' && e.target.parentElement.nodeName === 'A')

  if (!isValidTarget) return

  // if (e.target.tagName !== 'A') return
  let id = e.target.closest('a').getAttribute('data-id')
  const offsetParent = getOffsetTop(e.target.closest('.toc__item'))

  if (!id) return

  if (offsetParent === 0) id = '1'

  // Update the active heading using the setActiveHeading function
  setActiveHeading(id)

  // find all a tag in this .tiptap__toc and remove active class
  const aTags = document.querySelectorAll('.toc__item a')
  aTags.forEach((a) => a.classList.remove('active'))
  // now add active class to the clicked a tag
  e.target.classList.add('active')

  const targetHeading = document.querySelector(`.heading[data-id="${id}"]`)

  if (!targetHeading) return

  const posAt = editor?.view.posAtDOM(targetHeading, 0)
  if (posAt === -1) return

  const nodePos = editor.view.state.doc?.resolve(editor?.view.posAtDOM(targetHeading, 0))
  //@ts-ignore
  const headingPath = nodePos.path
    .filter((x: any) => x?.type?.name === TIPTAP_NODES.HEADING_TYPE)
    .map((x: any) => slugify(x.firstChild.textContent.toLowerCase().trim()))

  const url = new URL(window.location.href)
  url.searchParams.set('h', headingPath.join('>'))
  url.searchParams.set('id', id)
  window.history.replaceState({}, '', url)

  targetHeading?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  if (openChatRoom && id) {
    PubSub.publish(CHAT_OPEN, {
      headingId: id
    })
  }
}
