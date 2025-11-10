import { immer } from 'zustand/middleware/immer'

export type KeyboardState = 'opening' | 'closing' | 'open' | 'closed'

export interface IVirtualKeyboardStore {
  isKeyboardOpen: boolean
  keyboardHeight: number
  virtualKeyboardState: KeyboardState
  setKeyboardOpen: (isOpen: boolean) => void
  setKeyboardHeight: (height: number) => void
  setVirtualKeyboardState: (state: KeyboardState) => void
}

const virtualKeyboardStore = immer<IVirtualKeyboardStore>((set) => ({
  isKeyboardOpen: false,
  keyboardHeight: 0,
  virtualKeyboardState: 'closed',
  setKeyboardOpen: (isKeyboardOpen) => set({ isKeyboardOpen }),
  setKeyboardHeight: (keyboardHeight) => set({ keyboardHeight }),
  setVirtualKeyboardState: (virtualKeyboardState) => set({ virtualKeyboardState })
}))

export default virtualKeyboardStore
