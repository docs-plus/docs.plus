import { TMessageWithUser } from '@api'
import { immer } from 'zustand/middleware/immer'

export type TMessage = TMessageWithUser

export interface ThreadState {
  startThreadMessage: TMessage | null
  clearThread: () => void
}

const threadStore = immer<ThreadState>((set) => ({
  startThreadMessage: null,

  clearThread: () =>
    set((state) => {
      state.startThreadMessage = null
    })
}))

export default threadStore
