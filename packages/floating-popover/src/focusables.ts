// A plain literal: nothing runs at load, so a bundler can drop this module unused.
const FOCUSABLE_SELECTOR =
  'button:not([tabindex="-1"]), [href]:not([tabindex="-1"]), input:not([tabindex="-1"]), ' +
  'select:not([tabindex="-1"]), textarea:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])'

// Skips controls that cannot take focus. Without this, Tab onto a disabled
// Apply button is a dead end: the key is cancelled and focus() does nothing.
const canTakeFocus = (el: HTMLElement): boolean =>
  !el.matches(':disabled') && !el.closest('[inert]') && el.getClientRects().length > 0

/** The controls the Tab cycle visits, in DOM order. */
export function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(canTakeFocus)
}
