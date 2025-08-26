import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  ChatroomContextValue,
  ChatroomProps,
  ChatroomVariant,
  DialogConfig
} from './types/chatroom.types'
import { useChannelInitialData, useMessageSubscription } from '@components/chatroom/hooks'
import { Modal, ModalContent } from '@components/ui/Dialog'

const ChatroomContext = createContext<ChatroomContextValue | null>(null)

export const useChatroomContext = () => {
  const context = useContext(ChatroomContext)
  if (!context) {
    throw new Error('useChatroomContext must be used within a Chatroom component')
  }
  return context
}

export const ChatroomProvider: React.FC<{
  channelId: string
  variant: keyof ChatroomVariant
  children: React.ReactNode
}> = ({ channelId, variant, children }) => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dialogContent, setDialogContent] = useState<React.ReactNode>(null)
  const [dialogConfig, setDialogConfig] = useState<DialogConfig>({})

  // retrive channel data, like messages and channel info and more
  const { isChannelDataLoaded } = useChannelInitialData(setError, channelId)
  // subscribe to channel, and listen to channel and message postgres_changes
  const { isDbSubscriptionReady } = useMessageSubscription(channelId)

  useEffect(() => {
    if (error) console.error(`[MessageFeedError]: Error loading messages, ${error}`)
  }, [error])

  // Dialog API methods
  const openDialog = useCallback((content: React.ReactNode, config: DialogConfig = {}) => {
    setDialogContent(content)
    setDialogConfig(config)
    setIsDialogOpen(true)
  }, [])

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false)
    setDialogContent(null)
    setDialogConfig({})
  }, [])

  const value: ChatroomContextValue = {
    channelId,
    variant,
    isLoading,
    error,
    isChannelDataLoaded,
    isDbSubscriptionReady,
    openDialog,
    closeDialog,
    isDialogOpen
  }

  return (
    <ChatroomContext.Provider value={value}>
      {children}
      <Modal open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <ModalContent size={dialogConfig.size || 'md'} className={dialogConfig.className}>
          {dialogContent}
        </ModalContent>
      </Modal>
    </ChatroomContext.Provider>
  )
}
