// `[tabindex]` has no value test on purpose. The `tabIndex >= 0` filter reads the parsed
// value, so it drops `-1`, `-2` and `-01` alike; a string test catches only `-1`.
const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]'

/** Tab stops in DOM order. A radio group is one stop, its checked radio, as the browser does. */
export const tabbablesIn = (root: ParentNode): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>(TABBABLE)).filter(
    (el) =>
      el.tabIndex >= 0 &&
      el.getClientRects().length > 0 &&
      !el.closest('[inert], [aria-hidden="true"]') &&
      !(
        el instanceof HTMLInputElement &&
        el.type === 'radio' &&
        el.name &&
        !el.checked &&
        root.querySelector(`input[type="radio"][name="${CSS.escape(el.name)}"]:checked`)
      )
  )
