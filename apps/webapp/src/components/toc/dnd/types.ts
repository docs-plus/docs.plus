/** The gap between two visible rows that the pointer targets during a drag. */
export interface DropGap {
  /** Index into the drag's row list; the gap sits before `rows[index]`. */
  index: number
  upperId: string | null
  lowerId: string | null
  /** The row the line is drawn against: the lower row, else the upper row. */
  rect: DOMRect
  indicatorY: number
}

export interface DragRow {
  id: string
  rect: DOMRect
}

// Hysteresis so the gap / indicator do not flicker mid-drag.
export const GAP_HYSTERESIS = 4 // px past a row's midline before the gap switches
export const INDICATOR_Y_HYSTERESIS = 8 // px — keep prior Y if within this
