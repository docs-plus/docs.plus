import { immer } from 'zustand/middleware/immer'

export type EmojiPickerPosition = {
  top: number
  left: number
}

export type EmojiPickerEventType = 'react2Message' | 'inserEmojiToEditor' | 'inserEmojiToMessage'

type EmojiPickerState = {
  isOpen: boolean
  position: EmojiPickerPosition
  selectedMessage: any | null
  eventType: EmojiPickerEventType | null
  editor: any | null
}

interface IEmojiPickerStore {
  emojiPicker: EmojiPickerState
  openEmojiPicker: (
    position: EmojiPickerPosition,
    eventType: EmojiPickerEventType,
    message?: any,
    editor?: any
  ) => void
  toggleEmojiPicker: (
    position: EmojiPickerPosition,
    eventType: EmojiPickerEventType,
    message?: any,
    editor?: any
  ) => void
  closeEmojiPicker: () => void
}

const emojiPickerStore = immer<IEmojiPickerStore>((set, get) => ({
  emojiPicker: {
    isOpen: false,
    position: { top: 0, left: 0 },
    selectedMessage: null,
    eventType: null,
    editor: null
  },

  openEmojiPicker: (position, eventType, message = null, editor = null) => {
    set((state) => {
      state.emojiPicker = {
        isOpen: true,
        position,
        eventType,
        selectedMessage: message,
        editor
      }
    })
  },

  toggleEmojiPicker: (position, eventType, message = null, editor = null) => {
    set((state) => {
      state.emojiPicker = {
        isOpen: !state.emojiPicker.isOpen,
        position,
        eventType,
        selectedMessage: message,
        editor
      }
    })
  },

  closeEmojiPicker: () => {
    set((state) => {
      state.emojiPicker = {
        isOpen: false,
        position: { top: 0, left: 0 },
        selectedMessage: null,
        eventType: null,
        editor: null
      }
    })
  }
}))

export default emojiPickerStore
