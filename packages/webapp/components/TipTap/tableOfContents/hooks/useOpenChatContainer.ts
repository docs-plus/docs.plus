import { useCallback } from 'react'
import { useChatStore, useAuthStore, useStore } from '@stores'
import { useRouter } from 'next/router'
import slugify from 'slugify'
import ENUMS from '../../enums'
import * as toast from '@components/toast'

const useOpenChatContainer = () => {
  const router = useRouter()
  const { query } = router
  const setChatRoom = useChatStore((state) => state.setChatRoom)
  const { headingId } = useChatStore((state) => state.chatRoom)
  const destroyChatRoom = useChatStore((state) => state.destroyChatRoom)
  const user = useAuthStore((state) => state.profile)
  const {
    workspaceId,
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  const openChatContainerHandler = useCallback(
    (item: any) => {
      if (!editor) return

      const nodePos = editor.view.state.doc.resolve(
        // @ts-ignore
        editor?.view?.posAtDOM(document.querySelector(`.heading[data-id="${item.id}"]`), 0)
      ) as any

      if (!user) {
        toast.Info('Please login to use chat feature')
        document.getElementById('btn_signin')?.click()
        return
      }

      // toggle chatroom
      if (headingId === item.id) {
        return destroyChatRoom()
      }

      destroyChatRoom()

      const headingPath = nodePos.path
        .filter((x: any) => x?.type?.name === ENUMS.NODES.HEADING_TYPE)
        .map((x: any) => {
          const text = x.firstChild.textContent.trim()
          return { text, id: x.attrs.id }
        })

      const headingAddress = headingPath.map((x: any, index: any) => {
        const prevHeadingPath = headingPath
          .slice(0, index)
          .map((x: any) => slugify(x.text, { lower: true, strict: true }))
          .join('>')

        const url = new URL(window.location.origin + `/${query.slugs?.at(0)}`)
        url.searchParams.set('h', prevHeadingPath)
        url.searchParams.set('id', x.id)

        return {
          ...x,
          slug: slugify(x.text),
          url: url.href
        }
      })

      // TODO: change naming => open chatroom
      if (workspaceId) setChatRoom(item.id, workspaceId, headingAddress, user)
    },
    [editor, workspaceId, headingId, user]
  )

  return openChatContainerHandler
}

export default useOpenChatContainer
