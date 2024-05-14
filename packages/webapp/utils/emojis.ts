export const isOnlyEmoji = (str: string): boolean => {
  // Check if the string starts with a number
  if (/^\d/.test(str)) {
    return false // Return false if the string starts with a number
  }
  // This regex pattern aims to match strings that consist solely of emojis,
  // including those with skin tone modifiers, zero-width joiners, etc.,
  // but exclude numbers and other non-emoji characters.
  const emojiRegex =
    /^(?:(?:\p{Emoji_Presentation}|\p{Emoji_Modifier_Base})\p{Emoji_Modifier}?|\p{Emoji})\p{Extended_Pictographic}*\uFE0F?$/u
  return emojiRegex.test(str)
}

export const splitEmojis = (str: string): string[] => {
  // Regular expression to match a single emoji
  const emojiRegex = /\p{Extended_Pictographic}/gu

  // Using match to find all emojis and then join them with new lines
  const emojis = str.match(emojiRegex)
  return emojis ? emojis.join('\n').split('\n') : []
}
