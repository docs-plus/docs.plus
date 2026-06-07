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
