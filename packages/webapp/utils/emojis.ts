export const isOnlyEmoji = (str: string): boolean => {
  // Return false for empty strings
  if (!str || str.trim() === '') {
    return false
  }

  // Remove all whitespace (spaces, newlines, tabs)
  const cleanedStr = str.replace(/\s+/g, '')

  // If there's nothing left after removing whitespace, return false
  if (cleanedStr === '') {
    return false
  }

  // Quick check for alphanumeric characters
  if (/[a-zA-Z0-9]/.test(cleanedStr)) {
    return false
  }

  // Unicode property patterns to match emojis
  // This covers:
  // - Emoji base characters
  // - Emoji modifiers
  // - Zero width joiners
  // - Variation selectors
  // - Regional indicators (for flags)
  const emojiPattern = /^[\p{Emoji}\p{Emoji_Modifier}\p{Emoji_Component}\u200D\uFE0F\uFE0E]+$/u

  return emojiPattern.test(cleanedStr)
}

export const splitEmojis = (str: string): string[] => {
  if (!str) return []

  // Remove whitespace
  const cleanedStr = str.trim()
  if (!cleanedStr) return []

  try {
    // First attempt: Try to split using Grapheme Clusters approach
    // This attempts to keep composite emojis intact (like family emojis, flags, etc.)

    // For simple cases, use Intl.Segmenter if available
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      try {
        const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
        const segments = [...segmenter.segment(cleanedStr)].map((s) => s.segment)
        return segments.filter((segment) => /\p{Emoji}/u.test(segment))
      } catch (e) {
        // Fallback if Intl.Segmenter fails
        console.warn('Intl.Segmenter failed:', e)
      }
    }

    // Fallback: Try to capture emojis with a regex pattern
    // This pattern tries to match:
    // 1. Emoji presentation sequences
    // 2. Emoji with skin tone modifiers
    // 3. Emoji ZWJ sequences (like family emojis)
    // 4. Flag sequences
    const emojiPattern =
      /((?:\p{Emoji}\p{Emoji_Modifier}?|\p{Emoji_Presentation}|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|[\u{1F1E6}-\u{1F1FF}]{2}|\p{Emoji}(\u200D\p{Emoji})+)+)/gu

    const matches = cleanedStr.match(emojiPattern)
    return matches || []
  } catch (e) {
    console.error('Error splitting emojis:', e)

    // Last resort fallback: just split into individual characters
    // This won't preserve composite emojis but at least won't crash
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

  console.log('Testing emoji detection:')
  testCases.forEach(({ input, expected }) => {
    const result = isOnlyEmoji(input)
    console.log(
      `"${input}": ${result === expected ? '✅' : '❌'} (got ${result}, expected ${expected})`
    )
  })

  // Test emoji splitting
  console.log('\nTesting emoji splitting:')
  const splitTestCases = ['😀', '👨‍🦰', '👨‍👩‍👧‍👦', '🇺🇸', '👍🏽', '👨‍🦰🫵🫶🚵‍♂️', '😀😂🤣']

  splitTestCases.forEach((input) => {
    const result = splitEmojis(input)
    console.log(`"${input}" → ${result.length} emojis: [${result.join(', ')}]`)
  })
}
