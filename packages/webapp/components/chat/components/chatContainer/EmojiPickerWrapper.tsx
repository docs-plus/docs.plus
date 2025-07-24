import React from 'react'
import data from '@emoji-mart/data/sets/14/native.json'
import Picker from '@emoji-mart/react'
import { useStore } from '@stores'

export const EmojiPickerWrapper = React.forwardRef(
  ({ isEmojiBoxOpen, emojiPickerPosition, closeEmojiPicker, handleEmojiSelect }: any, ref: any) => {
    const {
      settings: {
        editor: { isMobile }
      }
    } = useStore((state) => state)

    return (
      <div
        id="emoji_picker"
        className={isMobile ? 'absolute bottom-0 w-full' : 'fixed'}
        style={{
          ...(isMobile
            ? {}
            : {
                top: `${emojiPickerPosition.top}px`,
                left: `${emojiPickerPosition.left}px`
              }),
          visibility: isEmojiBoxOpen ? 'visible' : 'hidden',
          zIndex: 999
        }}
        ref={ref}>
        <Picker
          data={data}
          dynamicWidth={isMobile ? true : false}
          navPosition="bottom"
          previewPosition="none"
          searchPosition="sticky"
          skinTonePosition="search"
          {...(isMobile && {
            emojiSize: 34,
            emojiButtonSize: 42
          })}
          emojiVersion="14"
          set="native"
          theme="light"
          onClickOutside={closeEmojiPicker}
          onEmojiSelect={handleEmojiSelect}
        />
      </div>
    )
  }
)

EmojiPickerWrapper.displayName = 'EmojiPickerWrapper'
