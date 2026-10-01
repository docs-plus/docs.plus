/** Tailwind `px-N` spacing units (N × 0.25rem). Bleed classes are literal for JIT. */
export const sheetBodyPadTailwindUnits = 4

/** Sheet body horizontal pad; keep in sync with {@link sheetBodyPadTailwindUnits}. */
export const sheetBodyPadClassName = 'px-4'

const HORIZONTAL_PAD_BLEED: Record<number, string> = {
  2: '-mx-2 w-[calc(100%+1rem)]',
  4: '-mx-4 w-[calc(100%+2rem)]'
}

/** Negative margin + width to full-bleed against a `px-N` horizontal pad. */
export function horizontalPadBleedClass(units: number): string {
  return HORIZONTAL_PAD_BLEED[units] ?? ''
}

/** Full-bleed against {@link sheetBodyPadClassName}. */
export const sheetBodyBleedClassName = HORIZONTAL_PAD_BLEED[sheetBodyPadTailwindUnits]

/**
 * The one bottom safe-area inset for sheets, sheet footers and takeover panes. Keep it literal:
 * never build `max-md:${…}` from it, because Tailwind cannot see a prefix added at runtime.
 */
export const sheetSafeAreaPadClassName = 'pb-[max(1rem,env(safe-area-inset-bottom))]'

/** {@link sheetSafeAreaPadClassName} below `md` only, for takeover panes that are cards on desktop. */
export const sheetSafeAreaPadMobileClassName = 'max-md:pb-[max(1rem,env(safe-area-inset-bottom))]'

/** The `stack` body of `SheetLayout`: form sheets. Lists keep `bare` and own their geometry. */
export const sheetBodyStackClassName = 'gap-4 px-4 py-3'
