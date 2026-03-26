import { computePosition, offset, shift } from '@floating-ui/dom'

export async function repositionHandle(
  floatingEl: HTMLElement,
  referenceEl: HTMLElement
): Promise<void> {
  const { x, y } = await computePosition(referenceEl, floatingEl, {
    placement: 'left',
    middleware: [offset(4), shift({ padding: 8 })]
  })

  Object.assign(floatingEl.style, {
    left: `${x}px`,
    top: `${y}px`
  })
}
