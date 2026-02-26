import data from '@emoji-mart/data/sets/14/native.json'
import EmojiPicker from '@emoji-mart/react'
import { getEmojiMartTheme, useChatStore, useThemeStore } from '@stores'
import { useEffect, useRef } from 'react'

import { useEmojiPanelContext } from './context/EmojiPanelContext'

const EMOJI_PICKER_DARK_STYLES = `
  :host {
    background-color: var(--color-base-100) !important;
    color: var(--color-base-content) !important;
  }
  section, #root, [id="root"], .root {
    background-color: var(--color-base-100) !important;
    color: var(--color-base-content) !important;
  }
  input, [role="searchbox"], [type="search"], [class*="search"] input {
    background-color: var(--color-base-200) !important;
    color: var(--color-base-content) !important;
    border-color: var(--color-base-300) !important;
  }
  input::placeholder {
    color: var(--color-base-content);
    opacity: 0.6;
  }
  nav, [role="navigation"], [class*="nav"], [class*="category"] {
    background-color: var(--color-base-100) !important;
    border-color: var(--color-base-300) !important;
    color: var(--color-base-content) !important;
  }
  button, [role="button"], [class*="category"] svg, [class*="tab"] {
    color: var(--color-base-content) !important;
  }
  [class*="active"], [aria-selected="true"] {
    color: var(--color-primary) !important;
  }
  hr, [class*="divider"], [class*="separator"] {
    border-color: var(--color-base-300) !important;
  }
`

const THEMED_ATTR = 'data-docsplus-themed'

function useEmojiPickerTheme(ref: React.RefObject<HTMLDivElement | null>, isDark: boolean) {
  useEffect(() => {
    if (!isDark || !ref.current) return
    const inject = () => {
      const el = ref.current?.querySelector?.('em-emoji-picker') as
        | (HTMLElement & { shadowRoot?: ShadowRoot })
        | null
      if (!el?.shadowRoot || el.hasAttribute(THEMED_ATTR)) return false
      try {
        const sheet = new CSSStyleSheet()
        sheet.replaceSync(EMOJI_PICKER_DARK_STYLES)
        el.shadowRoot.adoptedStyleSheets = [...el.shadowRoot.adoptedStyleSheets, sheet]
        el.setAttribute(THEMED_ATTR, 'true')
        return true
      } catch {
        return false
      }
    }
    if (inject()) return
    const t = setTimeout(() => inject(), 100)
    return () => clearTimeout(t)
  }, [isDark, ref])
}

type Props = {
  emojiSelectHandler: (emoji: any) => void
}
export const Picker = ({ emojiSelectHandler }: Props) => {
  const { variant } = useEmojiPanelContext()
  const { closeEmojiPicker, emojiPicker } = useChatStore()
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme)
  const isDark = resolvedTheme !== 'docsplus'
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEmojiPickerTheme(wrapperRef, isDark)

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
        theme={getEmojiMartTheme(resolvedTheme)}
        onClickOutside={() => {
          if (emojiPicker.isOpen) closeEmojiPicker()
        }}
        onEmojiSelect={emojiSelectHandler}
      />
    </div>
  )
}
