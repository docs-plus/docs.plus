import { immer } from 'zustand/middleware/immer'
import { TMessageWithUser } from '@api'

export type TMessage = TMessageWithUser

// Define the state interface
export interface ThreadState {
  startThreadMessage: TMessage | null
  threadMessages: Map<string, Map<string, TMessage>>
  setStartThreadMessage: (message: TMessage | null) => void
  clearThread: () => void
}

// Implement the store with immer and support for channelId
const threadStore = immer<ThreadState>((set) => ({
  startThreadMessage: null,
  threadMessages: new Map(),

  setStartThreadMessage: (message: TMessage | null) =>
    set((state) => {
      // @ts-ignore
      state.startThreadMessage = message
    }),

  clearThread: () =>
    set((state) => {
      state.startThreadMessage = null
      state.threadMessages = new Map()
    })
}))

export default threadStore
