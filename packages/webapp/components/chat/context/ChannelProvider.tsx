import React, { createContext, useContext, useState, useEffect } from 'react'
import merge from 'lodash/merge'

type TSettings = {
  displayChannelBar?: boolean
  pickEmoji?: boolean
  displaySystemNotifyChip?: boolean
  textEditor?: {
    emojiPicker?: boolean
    toolbar?: boolean
    sendButton?: boolean
    attachmentButton?: boolean
  }
  contextMenue?: {
    readStatus?: boolean
    copyToDoc?: boolean
    replyInThread?: boolean
    reply?: boolean
    forward?: boolean
    pin?: boolean
    edite?: boolean
    delete?: boolean
    bookmark?: boolean
    reaction?: boolean
  }
}

interface ChannelContextValue {
  channelId: string
  setChannelId: React.Dispatch<React.SetStateAction<string>>
  settings: TSettings
  setSettings: React.Dispatch<React.SetStateAction<TSettings>>
}

interface IProviderProps {
  children: React.ReactNode
  initChannelId: string
  initSettings?: TSettings
}

const defaultContextValue: ChannelContextValue = {
  channelId: '', // Default channelId
  setChannelId: () => {}, // No-op function
  settings: {
    // Default settings structure
    displayChannelBar: true,
    pickEmoji: true,
    displaySystemNotifyChip: true,
    textEditor: {
      emojiPicker: true,
      toolbar: true,
      sendButton: true,
      attachmentButton: true
    },
    contextMenue: {
      readStatus: true,
      copyToDoc: true,
      replyInThread: true,
      reply: true,
      forward: true,
      pin: true,
      edite: true,
      delete: true,
      bookmark: true,
      reaction: true
    }
  },
  setSettings: () => {} // No-op function
}

const ChannelContext = createContext<ChannelContextValue>(defaultContextValue)

export const useChannel = () => useContext(ChannelContext)

export const ChannelProvider = ({ children, initChannelId, initSettings }: IProviderProps) => {
  const [channelId, setChannelId] = useState<string>(initChannelId)
  const [settings, setSettings] = useState<TSettings>(defaultContextValue.settings)

  useEffect(() => {
    setChannelId(initChannelId)
  }, [initChannelId])

  useEffect(() => {
    if (!initSettings) return
    const updatedSettings = merge({}, defaultContextValue.settings, initSettings)
    setSettings(updatedSettings)
  }, [initSettings])

  const value: ChannelContextValue = {
    channelId,
    setChannelId,
    settings,
    setSettings
  }

  return <ChannelContext.Provider value={value}>{children}</ChannelContext.Provider>
}
