import { useEffect, useState } from 'react'

import { HOME_MOBILE_MQ, isHomeSlugInput } from '../homeMobileLayout'

/** visualViewport shrinks below this ratio of layout height when the keyboard is up. */
const KEYBOARD_HEIGHT_RATIO = 0.82

export function useHomeKeyboardCompact() {
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    const vv = window.visualViewport
    const mobileMq = window.matchMedia(HOME_MOBILE_MQ)
    let blurTimer: ReturnType<typeof setTimeout> | null = null

    const isViewportShrunk = () => {
      if (!vv || window.innerHeight === 0) return false
      return vv.height / window.innerHeight < KEYBOARD_HEIGHT_RATIO
    }

    const sync = () => {
      if (!mobileMq.matches) {
        setCompact(false)
        return
      }
      setCompact(isHomeSlugInput(document.activeElement) || isViewportShrunk())
    }

    const onFocusIn = (e: FocusEvent) => {
      if (!mobileMq.matches) return
      if (blurTimer) clearTimeout(blurTimer)
      if (isHomeSlugInput(e.target)) {
        setCompact(true)
      }
    }

    const onFocusOut = () => {
      blurTimer = setTimeout(sync, 120)
    }

    sync()
    mobileMq.addEventListener('change', sync)
    vv?.addEventListener('resize', sync)
    vv?.addEventListener('scroll', sync)
    document.addEventListener('focusin', onFocusIn, true)
    document.addEventListener('focusout', onFocusOut, true)

    return () => {
      if (blurTimer) clearTimeout(blurTimer)
      mobileMq.removeEventListener('change', sync)
      vv?.removeEventListener('resize', sync)
      vv?.removeEventListener('scroll', sync)
      document.removeEventListener('focusin', onFocusIn, true)
      document.removeEventListener('focusout', onFocusOut, true)
    }
  }, [])

  return compact
}
