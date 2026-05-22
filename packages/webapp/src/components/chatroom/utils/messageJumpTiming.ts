/** Keep in sync with `.msg_card--flash` in globals.scss */
export const MESSAGE_HIGHLIGHT_MS = 1500

export const MESSAGE_FLASH_AFTER_SMOOTH_SCROLL_MS = 400
export const MESSAGE_FLASH_AFTER_INSTANT_SCROLL_MS = 250

function createGenerationGate() {
  let generation = 0
  return {
    runAfter(delayMs: number, fn: () => void): void {
      const ticket = ++generation
      window.setTimeout(() => {
        if (ticket !== generation) return
        fn()
      }, delayMs)
    },
    invalidate(): void {
      generation++
    }
  }
}

export const highlightClearGate = createGenerationGate()
export const scrollFlashGate = createGenerationGate()
