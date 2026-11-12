import type { Transaction } from '@tiptap/pm/state'
import type { StepMap } from '@tiptap/pm/transform'

export type Range = { from: number; to: number }
export type ChangedRange = { oldRange: Range; newRange: Range }

const hasRanges = (map: StepMap): boolean => {
  let found = false
  map.forEach(() => {
    found = true
  })
  return found
}

/**
 * Same result as Tiptap's `getChangedRanges(combineTransactionSteps(doc, transactions))`, without
 * applying any step again. Mark steps have empty maps, so only maps with ranges are walked: linear
 * in mark steps. The final simplify pass stays quadratic in the number of changes, as Tiptap's is.
 */
export function changedRanges(transactions: readonly Transaction[]): {
  changes: ChangedRange[]
  map: (pos: number) => number
} {
  const steps: { from?: number; to?: number }[] = []
  const maps: StepMap[] = []
  for (const transaction of transactions) {
    transaction.steps.forEach((step, i) => {
      steps.push(step as { from?: number; to?: number })
      maps.push(transaction.mapping.maps[i])
    })
  }
  const live = maps.flatMap((map, i) => (hasRanges(map) ? [i] : []))
  const inverted = live.map((i) => maps[i].invert()).reverse()
  // Tiptap maps a range through `mapping.slice(k)`: the step's own map and every map after it.
  const forward = (pos: number, k: number, assoc: number): number => {
    let out = pos
    for (const i of live) if (i >= k) out = maps[i].map(out, assoc)
    return out
  }
  const back = (pos: number, assoc: number): number => {
    let out = pos
    for (const map of inverted) out = map.map(out, assoc)
    return out
  }

  const raw: ChangedRange[] = []
  maps.forEach((map, k) => {
    const ranges: [number, number][] = []
    if (hasRanges(map)) {
      map.forEach((from, to) => {
        ranges.push([from, to])
      })
    } else {
      const { from, to } = steps[k]
      if (from === undefined || to === undefined) return
      ranges.push([from, to])
    }
    for (const [from, to] of ranges) {
      const newFrom = forward(from, k, -1)
      const newTo = forward(to, k, 1)
      raw.push({
        oldRange: { from: back(newFrom, -1), to: back(newTo, 1) },
        newRange: { from: newFrom, to: newTo }
      })
    }
  })

  return { changes: simplify(raw), map: (pos) => forward(pos, 0, 1) }
}

// Tiptap's simplifyChangedRanges: drop exact duplicates, then any range inside another one.
function simplify(changes: ChangedRange[]): ChangedRange[] {
  const seen = new Set<string>()
  const unique = changes.filter(({ oldRange: o, newRange: n }) => {
    const key = `${o.from},${o.to},${n.from},${n.to}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (unique.length === 1) return unique
  return unique.filter((change, i) =>
    unique.every(
      (other, j) =>
        j === i ||
        !(
          change.oldRange.from >= other.oldRange.from &&
          change.oldRange.to <= other.oldRange.to &&
          change.newRange.from >= other.newRange.from &&
          change.newRange.to <= other.newRange.to
        )
    )
  )
}
