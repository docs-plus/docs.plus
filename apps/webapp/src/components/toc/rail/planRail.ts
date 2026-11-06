import type { TocItem } from '@types'

// Must match the tick button's h-2 (8px).
export const TICK_ROW_PX = 8
const TICK_OVERSCAN = 16
const RAIL_SPY_CONTEXT_TICKS = 8
const RAIL_MAX_VIEWPORT_RATIO = 0.84

export type RailItem = Pick<TocItem, 'id' | 'level' | 'open'>

type RailPlan<T extends RailItem> = {
  /** Ticks that fit `maxTicks`. Returns the folded list itself when it all fits. */
  fit: (maxTicks: number, spyId: string | null) => T[]
  /** The tick that stands for `id`: itself, else its nearest visible ancestor. */
  tickFor: (visible: T[], id: string | null) => string | null
}

type RailLayout = {
  start: number
  end: number
  stackH: number
  stackOffset: number
}

function foldRail<T extends RailItem>(items: T[]): T[] {
  const out: T[] = []
  let hideDeeperThan: number | null = null
  for (const item of items) {
    if (hideDeeperThan != null && item.level > hideDeeperThan) continue
    out.push(item)
    hideDeeperThan = item.open ? null : item.level
  }
  return out
}

function deepestKeptLevel(items: RailItem[], maxTicks: number) {
  let deepest = 1
  for (const item of items) {
    if (item.level > deepest) deepest = item.level
  }
  if (!Number.isFinite(maxTicks) || items.length <= maxTicks) return deepest

  let kept = items.length
  while (kept > maxTicks && deepest > 1) {
    deepest -= 1
    kept = 0
    for (const item of items) {
      if (item.level <= deepest) kept += 1
    }
  }
  return deepest
}

function sectionRootIndex(items: RailItem[], spyId: string | null, cap: number) {
  const spyAt = spyId ? items.findIndex((item) => item.id === spyId) : -1
  const from = spyAt >= 0 ? spyAt : 0
  for (let i = from; i >= 0; i--) {
    if (items[i].level <= cap) return i
  }
  return 0
}

function fillDeeperAroundSpy<T extends RailItem>(
  items: T[],
  cap: number,
  extra: number,
  spyId: string | null
): T[] {
  if (extra <= 0) return []
  const root = sectionRootIndex(items, spyId, cap)
  const picked: T[] = []
  const take = (start: number, end: number) => {
    for (let i = start; i < end && picked.length < extra; i++) {
      if (items[i].level > cap) picked.push(items[i])
    }
  }
  take(root + 1, items.length)
  take(0, root)
  return picked
}

function fitRailItems<T extends RailItem>(items: T[], maxTicks: number, spyId: string | null): T[] {
  if (!Number.isFinite(maxTicks) || items.length <= maxTicks) return items
  const cap = deepestKeptLevel(items, maxTicks)
  const keep = new Set<string>()
  for (const item of items) {
    if (item.level <= cap) keep.add(item.id)
  }
  const extra = maxTicks - keep.size
  for (const item of fillDeeperAroundSpy(items, cap, extra, spyId)) {
    keep.add(item.id)
  }
  return items.filter((item) => keep.has(item.id))
}

function visibleTickId(items: RailItem[], visible: RailItem[], id: string | null): string | null {
  if (!id) return null
  if (visible.some((item) => item.id === id)) return id
  const idx = items.findIndex((item) => item.id === id)
  if (idx < 0) return null
  let need = items[idx].level
  for (let i = idx - 1; i >= 0; i--) {
    const ancestor = items[i]
    if (ancestor.level >= need) continue
    need = ancestor.level
    if (visible.some((item) => item.id === ancestor.id)) return ancestor.id
  }
  return null
}

/**
 * Folds the outline once. The caller memoizes the plan on `items` and `fit` on its
 * own inputs, so `visible` keeps its identity while nothing it depends on changes.
 */
export function planRail<T extends RailItem>(items: T[]): RailPlan<T> {
  const folded = foldRail(items)
  return {
    fit: (maxTicks, spyId) => fitRailItems(folded, maxTicks, spyId),
    tickFor: (visible, id) => visibleTickId(items, visible, id)
  }
}

/** Tick budget: the live rail, capped at 84% of the viewport. `viewH` 0 reads the window. */
export function railTickBudget(navH: number, viewH: number) {
  const vh = viewH > 0 ? viewH : window.innerHeight
  if (vh <= 0 && navH <= 0) return Number.POSITIVE_INFINITY
  const viewCap = vh > 0 ? vh * RAIL_MAX_VIEWPORT_RATIO : navH
  const measured = navH > 0 ? Math.min(navH, viewCap) : viewCap
  return Math.max(1, Math.floor(measured / TICK_ROW_PX))
}

/** Rendered tick window plus the offset that centers a short stack in the live rail. */
export function railLayout(args: { count: number; scrollTop: number; height: number }): RailLayout {
  const { count, scrollTop, height } = args
  const stackH = count * TICK_ROW_PX
  const room = height - stackH
  const stackOffset = stackH <= 0 || height <= 0 || room <= 0 ? 0 : Math.floor(room / 2)
  if (count === 0) return { start: 0, end: 0, stackH, stackOffset }
  const start = Math.max(0, Math.floor(scrollTop / TICK_ROW_PX) - TICK_OVERSCAN)
  const end = Math.min(
    count,
    Math.ceil((scrollTop + (height || 640)) / TICK_ROW_PX) + TICK_OVERSCAN
  )
  return { start, end, stackH, stackOffset }
}

function clampScroll(next: number, max: number) {
  return Math.max(0, Math.min(max, next))
}

/** Keep-in-view scroll for the spy tick: no move while it sits inside the padded band. */
export function railSpyScrollTop(index: number, count: number, innerH: number, current: number) {
  const row = TICK_ROW_PX
  const total = count * row
  const maxScroll = Math.max(0, total - innerH)
  if (maxScroll === 0) return 0

  const rowTop = index * row
  const rowBottom = rowTop + row
  const rowMid = rowTop + row / 2
  const viewTop = current
  const viewBottom = current + innerH
  const pad = Math.min(RAIL_SPY_CONTEXT_TICKS * row, Math.floor(innerH / 4))

  if (rowBottom < viewTop || rowTop > viewBottom) {
    return clampScroll(rowMid - innerH / 2, maxScroll)
  }
  if (rowTop >= viewTop + pad && rowBottom <= viewBottom - pad) return current
  if (rowTop < viewTop + pad) return clampScroll(rowTop - pad, maxScroll)
  return clampScroll(rowBottom + pad - innerH, maxScroll)
}
