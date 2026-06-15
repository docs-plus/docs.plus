import type { MediaActionContext } from './types'

// Internal bridge: lets the controls layer refresh a mounted bar's nodePos
// without importing toolbar internals beyond this module (no utils↔toolbar cycle).
const contextByToolbar = new WeakMap<HTMLElement, MediaActionContext>()

/** Only the default factory registers; host-provided toolbars opt out by never appearing here. */
export function registerToolbarContext(bar: HTMLElement, ctx: MediaActionContext): void {
  contextByToolbar.set(bar, ctx)
}

/** Action handlers close over ctx and read it at click time, so mutating in place is enough. */
export function updateToolbarContextNodePos(wrapper: HTMLElement, nodePos: number): void {
  const bar = wrapper.querySelector<HTMLElement>(':scope > [data-hm-toolbar]')
  const ctx = bar ? contextByToolbar.get(bar) : undefined
  if (ctx) ctx.nodePos = nodePos
}
