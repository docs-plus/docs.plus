import { useState, useCallback, useEffect, useMemo } from 'react'
import { emojiReaction } from '@api'
import { useChatStore } from '@stores'
import { useChannel } from '../context/ChannelProvider'
import { TChannelSettings } from '@types'

export const useEmojiBoxHandler = (emojiPikerRef: any, messageContainerRef: any) => {
  const { channelId } = useChannel()
  const [isEmojiBoxOpen, setIsEmojiBoxOpen] = useState(false)
  const [selectedEmoji, setSelectedEmoji] = useState(null)
  const [emojiPickerPosition, setEmojiPickerPosition] = useState({ top: 0, left: 0 })
  const [selectedMessage, setSelectedMessage] = useState(null)
  const [eventTypes, setEventTypes] = useState(null)
  const [editor, setEditor] = useState<any>(null)
  const channels = useChatStore((state) => state.workspaceSettings.channels)
  const channelSettings = useMemo<TChannelSettings | null>(
    () => channels.get(channelId) ?? null,
    [channels, channelId]
  )

  const { userPickingEmoji } = channelSettings ?? {}

  useEffect(() => {
    const toggelEmojiPickerHandler = (e: any) => {
      if (!emojiPikerRef?.current) return
      const event = e.detail.clickEvent
      const message = e.detail?.message
      const type = e.detail.type
      const editor = e.detail?.editor
      const coordinates = e.detail?.coordinates
      setEditor(editor)
      setEventTypes(type)

      const { clientHeight, clientWidth } = emojiPikerRef?.current

      // we need to pick up these dynamic values from the DOM
      const emojiButtonWidth = 24
      const chatEditorHeight = 153

      let newTop, newLeft

      if (coordinates) {
        // Use provided coordinates
        newTop = coordinates.y || coordinates.top
        newLeft = coordinates.x || coordinates.left
      } else {
        // Fallback to DOM positioning
        const rect =
          event.currentTarget?.getBoundingClientRect() || event.target?.getBoundingClientRect()
        if (!rect) {
          console.error('rect is null')
          return
        }
        newTop = rect.bottom + window.scrollY
        newLeft = rect.left + window.scrollX
      }

      // Adjust for right and bottom edges
      if (newLeft + clientWidth + emojiButtonWidth > window.innerWidth) {
        newLeft = newLeft - clientWidth
      }
      if (newTop + clientHeight + chatEditorHeight > window.innerHeight) {
        newTop = newTop - clientHeight
      }

      // Adjust for top and left edges
      newTop = Math.max(0, newTop)
      newLeft = Math.max(0, newLeft)

      setEmojiPickerPosition({ top: newTop, left: newLeft })
      setIsEmojiBoxOpen(!isEmojiBoxOpen)
      setSelectedMessage(message)
    }

    document.addEventListener('toggelEmojiPicker', toggelEmojiPickerHandler)

    return () => {
      document.removeEventListener('toggelEmojiPicker', toggelEmojiPickerHandler)
    }
  }, [emojiPikerRef])

  const handleEvent = useCallback(
    (event: any) => {
      if (event.type === 'scroll' && userPickingEmoji) return
      closeEmojiPicker()
    },
    [userPickingEmoji]
  )

  useEffect(() => {
    // Only attach listeners if the emoji box is open and the container exists
    if (!isEmojiBoxOpen || !messageContainerRef.current) {
      return
    }

    // Attach event listeners
    const msgContainer = messageContainerRef.current
    msgContainer.addEventListener('scroll', handleEvent)
    window.addEventListener('resize', handleEvent)

    // Clean up event listeners
    return () => {
      msgContainer.removeEventListener('scroll', handleEvent)
      window.removeEventListener('resize', handleEvent)
    }
  }, [isEmojiBoxOpen]) // Depend only on isEmojiBoxOpen

  const openEmojiPicker = useCallback(() => {
    setIsEmojiBoxOpen(true)
  }, [isEmojiBoxOpen])

  const closeEmojiPicker = useCallback(() => {
    if (isEmojiBoxOpen) setIsEmojiBoxOpen(false)
  }, [isEmojiBoxOpen])

  const handleEmojiSelect = useCallback(
    (emoji: any) => {
      if (!isEmojiBoxOpen) return
      setSelectedEmoji(emoji)
      if (eventTypes === 'react2Message') {
        emojiReaction(selectedMessage, emoji.native)
      }
      if (eventTypes === 'inserEmojiToEditor') {
        editor?.chain().focus().insertContent(emoji.native).run()
      }
      closeEmojiPicker()
    },
    [isEmojiBoxOpen]
  )

  const toggleEmojiPicker = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const { clientHeight, clientWidth } = emojiPikerRef.current

      // we need to pick up these dynamic values from the DOM
      const emojiButtonWidth = 24
      const chatEditorHeight = 153

      // Use getBoundingClientRect if positioning relative to an element
      const rect = event.currentTarget.getBoundingClientRect()
      let newTop = rect.bottom + window.scrollY
      let newLeft = rect.left + window.scrollX

      // Adjust for right and bottom edges
      if (newLeft + clientWidth + emojiButtonWidth > window.innerWidth) {
        newLeft = newLeft - clientWidth
      }
      if (newTop + clientHeight + chatEditorHeight > window.innerHeight) {
        newTop = newTop - clientHeight
      }

      // Adjust for top and left edges
      newTop = Math.max(0, newTop)
      newLeft = Math.max(0, newLeft)

      setEmojiPickerPosition({ top: newTop, left: newLeft })
      setIsEmojiBoxOpen(!isEmojiBoxOpen)
    },
    [isEmojiBoxOpen]
  )

  useEffect(() => {
    const handleCloseEmojiPicker = () => closeEmojiPicker()

    document.addEventListener('closeEmojiPicker', handleCloseEmojiPicker)

    return () => {
      document.removeEventListener('closeEmojiPicker', handleCloseEmojiPicker)
    }
  }, [])

  return {
    isEmojiBoxOpen,
    openEmojiPicker,
    closeEmojiPicker,
    selectedEmoji,
    handleEmojiSelect,
    toggleEmojiPicker,
    emojiPickerPosition
  }
}
