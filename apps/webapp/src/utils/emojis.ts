export const isOnlyEmoji = (str: string): boolean => {
  if (!str || str.trim() === '') {
    return false
  }

  const cleanedStr = str.replace(/\s+/g, '')

  if (cleanedStr === '') {
    return false
  }

  if (/[a-zA-Z0-9]/.test(cleanedStr)) {
    return false
  }

  // Covers base emoji, modifiers, ZWJ, variation selectors, and flag regional indicators.
  // eslint-disable-next-line no-misleading-character-class
  const emojiPattern = /^[\p{Emoji}\p{Emoji_Modifier}\p{Emoji_Component}\u200D\uFE0F\uFE0E]+$/u

  return emojiPattern.test(cleanedStr)
}

export const splitEmojis = (str: string): string[] => {
  if (!str) return []

  const cleanedStr = str.trim()
  if (!cleanedStr) return []

  try {
    // Grapheme clusters keep composite emojis (family, flags, skin tones) intact.
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      try {
        const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
        const segments = [...segmenter.segment(cleanedStr)].map((s) => s.segment)
        return segments.filter((segment) => /\p{Emoji}/u.test(segment))
      } catch (e) {
        console.warn('Intl.Segmenter failed:', e)
      }
    }

    // Hand-rolled equivalent: presentation sequences, skin-tone modifiers, ZWJ
    // sequences, and flag pairs.
    const emojiPattern =
      /((?:\p{Emoji}\p{Emoji_Modifier}?|\p{Emoji_Presentation}|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|[\u{1F1E6}-\u{1F1FF}]{2}|\p{Emoji}(\u200D\p{Emoji})+)+)/gu

    const matches = cleanedStr.match(emojiPattern)
    return matches || []
  } catch (e) {
    console.error('Error splitting emojis:', e)

    // Per-character split loses composite emojis, but it cannot throw.
    return [...cleanedStr].filter((char) => /\p{Emoji}/u.test(char))
  }
}

// For debugging/testing emoji detection
export const testEmojiDetection = () => {
  const testCases = [
    { input: '😀', expected: true },
    { input: '👨‍🦰', expected: true },
    { input: '👨‍👩‍👧‍👦', expected: true },
    { input: '🇺🇸', expected: true },
    { input: '👍🏽', expected: true },
    { input: '👨‍🦰🫵🫶🚵‍♂️', expected: true },
    { input: 'Hello', expected: false },
    { input: '123', expected: false },
    { input: '😀 Hello', expected: false },
    { input: '😀\n\n', expected: true },
    { input: '', expected: false }
  ]

  console.info('Testing emoji detection:')
  testCases.forEach(({ input, expected }) => {
    const result = isOnlyEmoji(input)
    console.info(
      `"${input}": ${result === expected ? '✅' : '❌'} (got ${result}, expected ${expected})`
    )
  })

  console.info('\nTesting emoji splitting:')
  const splitTestCases = ['😀', '👨‍🦰', '👨‍👩‍👧‍👦', '🇺🇸', '👍🏽', '👨‍🦰🫵🫶🚵‍♂️', '😀😂🤣']

  splitTestCases.forEach((input) => {
    const result = splitEmojis(input)
    console.info(`"${input}" → ${result.length} emojis: [${result.join(', ')}]`)
  })
}
