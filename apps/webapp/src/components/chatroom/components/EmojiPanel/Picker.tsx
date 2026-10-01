import { closeMessageReaction } from '@components/chatroom/utils/messageReaction'
import data from '@emoji-mart/data/sets/14/native.json'
import EmojiPicker from '@emoji-mart/react'
import { isLightTheme, useChatStore, useThemeStore } from '@stores'
import { useLayoutEffect, useRef } from 'react'

import { useEmojiPanelContext } from './context/EmojiPanelContext'

// emoji-mart paints with `rgb(var(--rgb-*))`, so it needs "r, g, b" triplets that tokens cannot
// give. A probe resolves each token in the live theme; a 1px canvas turns it into sRGB.
const PICKER_RGB_TOKENS = {
  '--rgb-background': 'var(--color-base-100)',
  '--rgb-input': 'var(--color-base-200)',
  '--rgb-color': 'var(--color-base-content)',
  '--rgb-accent': 'var(--color-primary)'
}

function paintPickerRgbVars(host: HTMLElement) {
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (!ctx) return
  const probe = host.appendChild(document.createElement('span'))
  for (const [name, token] of Object.entries(PICKER_RGB_TOKENS)) {
    probe.style.color = token
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = getComputedStyle(probe).color
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    host.style.setProperty(name, `${r}, ${g}, ${b}`)
  }
  probe.remove()
}

type Props = {
  emojiSelectHandler: (emoji: any) => void
}
export const Picker = ({ emojiSelectHandler }: Props) => {
  const { variant } = useEmojiPanelContext()
  const isOpen = useChatStore((s) => s.emojiPicker.isOpen)
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme)
  const isDark = !isLightTheme(resolvedTheme)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // The theme store writes the DOM before it sets state, so this reads the new tokens.
  useLayoutEffect(() => {
    if (wrapperRef.current) paintPickerRgbVars(wrapperRef.current)
  }, [resolvedTheme])

  return (
    <div ref={wrapperRef}>
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
        theme={isDark ? 'dark' : 'light'}
        onClickOutside={() => {
          // Closes the reaction sheet too. Closing only the picker left the sheet
          // open with no message selected, so the next tap wrote no reaction.
          if (isOpen) closeMessageReaction()
        }}
        onEmojiSelect={emojiSelectHandler}
      />
    </div>
  )
}
