import { ReactNode } from 'react'
import { immer } from 'zustand/middleware/immer'

export interface DialogConfig {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  align?: 'center' | 'top'
  className?: string
  dismissible?: boolean
}

export interface DialogStore {
  globalDialog: {
    isOpen: boolean
    content: ReactNode | null
    config: DialogConfig
  }
  openDialog: (content: ReactNode, config?: DialogConfig) => void
  closeDialog: () => void
}

const dialogStore = immer<DialogStore>((set) => ({
  globalDialog: {
    isOpen: false,
    content: null,
    config: {}
  },

  openDialog: (content, config = {}) =>
    set({
      globalDialog: {
        isOpen: true,
        content: content,
        config: { dismissible: true, ...config }
      }
    }),

  closeDialog: () =>
    set({
      globalDialog: {
        isOpen: false,
        content: null,
        config: {}
      }
    })
}))

export default dialogStore
