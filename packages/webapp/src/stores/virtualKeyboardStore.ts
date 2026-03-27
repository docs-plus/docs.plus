import { immer } from 'zustand/middleware/immer'

export interface IVirtualKeyboardStore {
  isKeyboardOpen: boolean
  keyboardHeight: number
  setKeyboardOpen: (isOpen: boolean) => void
  setKeyboardHeight: (height: number) => void
}

const virtualKeyboardStore = immer<IVirtualKeyboardStore>((set) => ({
  isKeyboardOpen: false,
  keyboardHeight: 0,
  setKeyboardOpen: (isKeyboardOpen) => set({ isKeyboardOpen }),
  setKeyboardHeight: (keyboardHeight) => set({ keyboardHeight })
}))

export default virtualKeyboardStore
