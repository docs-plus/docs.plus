import { useEffect, useCallback } from 'react'
import debounce from 'lodash/debounce'
import { useChatStore } from '@stores'
import { Channel } from '@types'

const useUpdateDocPageUnreadMsg = () => {
  const channels = useChatStore((state) => state.channels)

  const updateUnreadIndicator = useCallback((channel: Channel) => {
    if (!channel || channel.unread_message_count === undefined) return

    const selectors = [
      `.wrapBlock[data-id="${channel.id}"] > .title .btnOpenChatBox`,
      `.wrapBlock[data-id="${channel.id}"] > .buttonWrapper .btn_openChatBox`
    ]

    selectors.forEach((selector) => {
      const element = document.querySelector(selector)
      if (!element) return

      if (channel.unread_message_count && channel.unread_message_count > 0) {
        element.setAttribute('data-unread-count', channel.unread_message_count.toString())
      } else {
        element.removeAttribute('data-unread-count')
      }
    })
  }, [])

  const updateAllUnreadIndicators = useCallback(
    debounce(() => {
      channels.forEach((channel, channelId) => {
        updateUnreadIndicator(channel)
      })
    }, 1000),
    [channels]
  )

  useEffect(() => {
    updateAllUnreadIndicators()
  }, [channels])
}

export default useUpdateDocPageUnreadMsg
