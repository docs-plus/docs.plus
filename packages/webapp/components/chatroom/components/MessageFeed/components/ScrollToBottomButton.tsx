import React, { useState, useEffect, useCallback, useRef } from 'react'
import { FaChevronDown } from 'react-icons/fa6'
import debounce from 'lodash/debounce'
import { useMessageFeedContext } from '../MessageFeedContext'
import { useChatStore } from '@stores'

export const ScrollToBottom = () => {
  const [showScrollButton, setShowScrollButton] = useState(false)
  const isReadyToDisplayMessages = useChatStore((state) => state.chatRoom.isReadyToDisplayMessages)

  // const { messageContainerRef } = useMessageFeedContext()
  const messageContainerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    messageContainerRef.current = document.querySelector('.message-feed') as HTMLDivElement
  }, [])
  // Handle scroll event: Determines whether to show or hide the button
  // based on the scroll position relative to the last message height.
  const handleScroll = useCallback(() => {
    if (!messageContainerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = document.querySelector(
      '.message-feed'
    ) as HTMLElement // messageContainerRef.current

    const lastChild = messageContainerRef.current.querySelector('.msg_card') as HTMLElement
    const lastChildHeight = (lastChild?.lastChild as HTMLElement)?.offsetHeight || 0

    if (scrollTop + clientHeight < scrollHeight - lastChildHeight) {
      setShowScrollButton(true)
    } else {
      setShowScrollButton(false)
    }
  }, [messageContainerRef])

  // Debounced version of the scroll event handler to improve performance.
  const debouncedHandleScroll = debounce(handleScroll, 200)

  // Effect to attach and detach the scroll event listener.
  useEffect(() => {
    const currentRef = messageContainerRef.current
    if (!currentRef || !isReadyToDisplayMessages) return

    const newRef = document.querySelector('.message-feed') as HTMLElement

    newRef.addEventListener('scroll', debouncedHandleScroll)

    return () => {
      newRef.removeEventListener('scroll', debouncedHandleScroll)
    }
  }, [debouncedHandleScroll, messageContainerRef, isReadyToDisplayMessages])

  // Handler to scroll to the bottom of the messages container.
  const scrollToBottomHandler = useCallback(() => {
    const lastChild = document.querySelector('.message-list')?.lastChild as HTMLElement
    if (lastChild) {
      messageContainerRef.current?.scrollTo({
        top: lastChild.offsetTop,
        behavior: 'smooth'
      })
    }
    setShowScrollButton(false)
  }, [messageContainerRef])

  return (
    <button
      onClick={scrollToBottomHandler}
      className={`btn btn-circle btn-primary absolute right-2 z-4 transition-all duration-300 ${
        showScrollButton
          ? 'bottom-3 opacity-100 delay-200'
          : 'pointer-events-none bottom-[-60px] opacity-0'
      }`}>
      <FaChevronDown size={23} color="#fff" />
    </button>
  )
}
