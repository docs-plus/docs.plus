import { computePosition, flip, offset, shift } from '@floating-ui/dom'

/*
 * Built on raw `@floating-ui/dom`, deliberately not `createPopover`: the engine
 * self-adopts into the one-popover-at-a-time controller, so showing a tooltip
 * would dismiss an open menu or dialog. One shared bubble serves every button.
 */

const SHOW_DELAY_MS = 400
const VISIBLE_CLASS = 'visible'

let bubble: HTMLDivElement | null = null
let showTimer: ReturnType<typeof setTimeout> | null = null

function ensureBubble(): HTMLDivElement {
  if (!bubble) {
    bubble = document.createElement('div')
    bubble.className = 'floating-tooltip'
    bubble.setAttribute('role', 'tooltip')
    document.body.append(bubble)
  }
  return bubble
}

function cancelShow(): void {
  if (showTimer !== null) {
    clearTimeout(showTimer)
    showTimer = null
  }
}

// No autoUpdate: tooltips are ephemeral, every hide/re-show re-positions.
async function show(target: HTMLElement, label: string): Promise<void> {
  if (!target.isConnected) return
  const el = ensureBubble()
  el.textContent = label
  const { x, y } = await computePosition(target, el, {
    strategy: 'fixed',
    placement: 'top',
    middleware: [offset(6), flip(), shift({ padding: 8 })]
  })
  el.style.left = `${x}px`
  el.style.top = `${y}px`
  el.classList.add(VISIBLE_CLASS)
}

/** Hide the shared tooltip bubble and cancel any pending show. */
export function hideTooltip(): void {
  cancelShow()
  bubble?.classList.remove(VISIBLE_CLASS)
}

/** Show `label` above `target` after a short hover/focus delay. Returns a detach function for surfaces that re-render in place. */
export function attachTooltip(target: HTMLElement, label: string): () => void {
  const schedule = (): void => {
    cancelShow()
    showTimer = setTimeout(() => {
      showTimer = null
      void show(target, label)
    }, SHOW_DELAY_MS)
  }
  // Keyboard focus only: click-focus would re-show over the popover the click opened.
  const scheduleOnFocus = (): void => {
    if (target.matches(':focus-visible')) schedule()
  }
  target.addEventListener('mouseenter', schedule)
  target.addEventListener('focus', scheduleOnFocus)
  target.addEventListener('mouseleave', hideTooltip)
  target.addEventListener('blur', hideTooltip)
  // Activation opens popovers; the tooltip must not linger over them.
  // `click` covers keyboard Enter/Space, which fire no pointerdown.
  target.addEventListener('pointerdown', hideTooltip)
  target.addEventListener('click', hideTooltip)
  return () => {
    target.removeEventListener('mouseenter', schedule)
    target.removeEventListener('focus', scheduleOnFocus)
    target.removeEventListener('mouseleave', hideTooltip)
    target.removeEventListener('blur', hideTooltip)
    target.removeEventListener('pointerdown', hideTooltip)
    target.removeEventListener('click', hideTooltip)
    hideTooltip()
  }
}
