import PubSub from 'pubsub-js'
import { useChatStore, useAuthStore, useStore } from '@stores'
import { NextRouter } from 'next/router'
import { scrollToHeading } from '@utils/index'
export const CHAT_COMMENT = Symbol('chat.comment')
export const CHAT_OPEN = Symbol('chat.open')
export const APPLY_FILTER = Symbol('apply.filter')
export const REMOVE_FILTER = Symbol('remove.filter')
export const RESET_FILTER = Symbol('reset.filter')

type TChatCommentData = {
  content: string
  html: string
  headingId: string
}

type TOpenChatData = {
  headingId: string
  scroll2Heading?: boolean
  toggleRoom?: boolean
  fetchMsgsFromId?: string
}

type TApplyFilterData = {
  slugs?: string[]
  href?: string
} & ({ slugs: string[] } | { href: string })

type TRemoveFilterData = {
  slug: string
}

export const eventsHub = (router: NextRouter) => {
  console.info('eventsHub initialized')

  PubSub.subscribe(CHAT_COMMENT, (msg, data: TChatCommentData) => {
    const { content, html, headingId } = data
    const { workspaceId } = useStore.getState().settings
    const { headingId: opendHeadingId } = useChatStore.getState().chatRoom
    const user = useAuthStore.getState().profile

    const setCommentMessageMemory = useChatStore.getState().setCommentMessageMemory
    const setChatRoom = useChatStore.getState().setChatRoom
    const destroyChatRoom = useChatStore.getState().destroyChatRoom

    setCommentMessageMemory(headingId, {
      content,
      html,
      channel_id: headingId,
      workspace_id: workspaceId,
      user
    })

    if (headingId === opendHeadingId) return destroyChatRoom()

    if (workspaceId) setChatRoom(headingId, workspaceId, [], user)
  })

  PubSub.subscribe(CHAT_OPEN, (msg, data: TOpenChatData) => {
    const { headingId, scroll2Heading = false, toggleRoom = true, fetchMsgsFromId } = data

    if (!headingId) return

    const { workspaceId } = useStore.getState().settings
    const user = useAuthStore.getState().profile
    const { headingId: opendHeadingId } = useChatStore.getState().chatRoom

    const setChatRoom = useChatStore.getState().setChatRoom
    const destroyChatRoom = useChatStore.getState().destroyChatRoom
    const switchChatRoom = useChatStore.getState().switchChatRoom

    if (opendHeadingId === headingId && toggleRoom) return destroyChatRoom()

    switchChatRoom(headingId)

    setTimeout(() => {
      // TODO: change naming => open chatroom
      if (workspaceId) {
        setChatRoom(headingId, workspaceId, [], user, fetchMsgsFromId)
        useChatStore.getState().openChatRoom()
      }

      if (scroll2Heading) scrollToHeading(headingId)
    }, 200)
  })

  PubSub.subscribe(APPLY_FILTER, (msg, data: TApplyFilterData) => {
    const setWorkspaceEditorSetting = useStore.getState().setWorkspaceEditorSetting
    const { slugs, href } = data

    // if (!href || !slugs) {
    //   console.error('[EventsHub]: apply filter: invalid data', data)
    //   return
    // }

    const url = new URL(href || router.asPath, window.location.origin)
    if (!href && slugs) url.pathname = `${url.pathname}/${encodeURIComponent(slugs.join('/'))}`

    router.push(url.toString(), undefined, { shallow: true })

    setWorkspaceEditorSetting('applyingFilters', true)
  })

  PubSub.subscribe(REMOVE_FILTER, (msg, data: TRemoveFilterData) => {
    const setWorkspaceEditorSetting = useStore.getState().setWorkspaceEditorSetting
    const { slug } = data

    const url = new URL(location.href)
    const segments = url.pathname.split('/').filter(Boolean)
    if (segments.length === 0) return

    const docSlug = segments[0]
    const filterSlugs = segments.slice(1)
    const idx = filterSlugs.indexOf(slug)
    if (idx !== -1) filterSlugs.splice(idx, 1)

    url.pathname = `/${docSlug}${filterSlugs.length ? '/' + filterSlugs.join('/') : ''}`

    router.push(url.toString(), undefined, { shallow: true })
    setWorkspaceEditorSetting('applyingFilters', true)
  })

  PubSub.subscribe(RESET_FILTER, (msg, data: string) => {
    const setWorkspaceEditorSetting = useStore.getState().setWorkspaceEditorSetting
    const url = new URL(router.asPath, window.location.origin)
    const slugs = url.pathname.split('/').slice(1)

    // Preserve the search parameters
    const newUrl = `/${slugs.at(0)}${url.search}`

    router.push(newUrl, undefined, { shallow: true })
    setTimeout(() => {
      setWorkspaceEditorSetting('applyingFilters', true)
    }, 500)
  })
}
