import data from '@emoji-mart/data/sets/14/native.json'
import EmojiPicker from '@emoji-mart/react'
import { useChatStore } from '@stores'

import { useEmojiPanelContext } from './context/EmojiPanelContext'

type Props = {
  emojiSelectHandler: (emoji: any) => void
}
export const Picker = ({ emojiSelectHandler }: Props) => {
  const { variant } = useEmojiPanelContext()
  const { closeEmojiPicker, emojiPicker } = useChatStore()

  return (
    <EmojiPicker
      data={data}
      dynamicWidth={variant === 'mobile' ? true : false}
      navPosition="bottom"
      previewPosition="none"
      searchPosition="sticky"
      skinTonePosition="search"
      {...(variant === 'mobile' && {
        emojiSize: 34,
        emojiButtonSize: 42
      })}
      emojiVersion="14"
      set="native"
      theme="light"
      onClickOutside={() => {
        if (emojiPicker.isOpen) closeEmojiPicker()
      }}
      onEmojiSelect={emojiSelectHandler}
    />
  )
}
