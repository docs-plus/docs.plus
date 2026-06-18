/** Keep in sync with `--motion-flash-hold` in _entry.scss and `.msg_card--flash` in globals.scss */
export const MESSAGE_HIGHLIGHT_MS = 2200

export const MESSAGE_FLASH_AFTER_SMOOTH_SCROLL_MS = 400
export const MESSAGE_FLASH_AFTER_INSTANT_SCROLL_MS = 250

const MESSAGE_FLASH_MOUNT_POLL_MAX = 20
const MESSAGE_FLASH_MOUNT_OBSERVE_MS = 1500
const MESSAGE_FEED_SELECTOR = '.message-feed'

function createGenerationGate() {
  let generation = 0
  return {
    isActive(ticket: number): boolean {
      return ticket === generation
    },
    runAfter(delayMs: number, fn: () => void): number {
      const ticket = ++generation
      window.setTimeout(() => {
        if (ticket !== generation) return
        fn()
      }, delayMs)
      return ticket
    },
    invalidate(): void {
      generation++
    }
  }
}

export const highlightClearGate = createGenerationGate()
export const scrollFlashGate = createGenerationGate()

function findMessageCardInFeed(messageId: string): Element | null {
  const feed = document.querySelector(MESSAGE_FEED_SELECTOR)
  return feed?.querySelector(`[data-msg-id="${CSS.escape(messageId)}"]`) ?? null
}

function whenMountedInFeed(messageId: string, ticket: number, fn: () => void): void {
  if (!scrollFlashGate.isActive(ticket)) return
  if (findMessageCardInFeed(messageId)) {
    fn()
    return
  }

  let attempt = 0
  const poll = () => {
    if (!scrollFlashGate.isActive(ticket)) return
    if (findMessageCardInFeed(messageId)) {
      fn()
      return
    }
    if (attempt++ >= MESSAGE_FLASH_MOUNT_POLL_MAX) {
      watchFeedForMount(messageId, ticket, fn)
      return
    }
    requestAnimationFrame(poll)
  }
  requestAnimationFrame(poll)
}

function watchFeedForMount(messageId: string, ticket: number, fn: () => void): void {
  const feed = document.querySelector(MESSAGE_FEED_SELECTOR)
  if (!feed) return

  let stopped = false
  const stop = () => {
    stopped = true
    observer.disconnect()
    window.clearTimeout(timer)
  }
  const tryRun = () => {
    if (stopped || !scrollFlashGate.isActive(ticket)) {
      stop()
      return
    }
    if (findMessageCardInFeed(messageId)) {
      stop()
      fn()
    }
  }

  const observer = new MutationObserver(tryRun)
  observer.observe(feed, { childList: true, subtree: true })
  const timer = window.setTimeout(stop, MESSAGE_FLASH_MOUNT_OBSERVE_MS)
  tryRun()
}

/** Scroll settle delay, then poll until the target row mounts inside `.message-feed`. */
export function scheduleMessageFlash(
  flash: (id: string) => void,
  messageId: string,
  delayMs: number
): void {
  const ticket = scrollFlashGate.runAfter(delayMs, () => {
    whenMountedInFeed(messageId, ticket, () => flash(messageId))
  })
}
