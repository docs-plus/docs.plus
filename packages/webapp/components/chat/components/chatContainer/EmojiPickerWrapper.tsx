import React from "react";
import data from "@emoji-mart/data/sets/14/native.json";
import Picker from "@emoji-mart/react";

export const EmojiPickerWrapper = React.forwardRef(
  ({ isEmojiBoxOpen, emojiPickerPosition, closeEmojiPicker, handleEmojiSelect }: any, ref: any) => {
    return (
      <div
        id="emoji_picker"
        className="fixed"
        style={{
          top: `${emojiPickerPosition.top}px`,
          left: `${emojiPickerPosition.left}px`,
          visibility: isEmojiBoxOpen ? "visible" : "hidden",
          zIndex: 999,
        }}
        ref={ref}
      >
        <Picker
          data={data}
          emojiVersion="14"
          set="native"
          onClickOutside={closeEmojiPicker}
          onEmojiSelect={handleEmojiSelect}
        />
      </div>
    );
  },
);

EmojiPickerWrapper.displayName = "EmojiPickerWrapper";
