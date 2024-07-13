import { useEffect } from 'react'
import { debounce } from 'lodash'
import { useStore, useChatStore } from '@stores'

const useUpdateDocPageUnreadMsg = () => {
  const channels = useChatStore((state) => state.channels)
  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  // Debounced function for update logic
  const debouncedUpdateLogic = debounce(() => {
    channels.forEach((channel: any) => {
      if (channel.unread_message_count) {
        const element = document.querySelector(
          `.wrapBlock[data-id="${channel.id}"] > .buttonWrapper .btn_openChatBox span`
        )
        if (element && channel.unread_message_count > 0) {
          element.innerHTML = channel.unread_message_count
        }
      }
    })
  }, 300) // Adjust the debounce delay (300ms in this example)

  // TODO: put this in a separate hook file
  useEffect(() => {
    if (!editor) return

    // Attach the debounced function to the 'update' event
    editor.on('update', debouncedUpdateLogic)

    // Cleanup function to remove the event listener
    return () => {
      editor.off('update', debouncedUpdateLogic)
    }
  }, [editor, channels, debouncedUpdateLogic])
}

export default useUpdateDocPageUnreadMsg
