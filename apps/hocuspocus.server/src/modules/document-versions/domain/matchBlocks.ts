import { MAX_DIFF_LCS_CELLS } from '../types'

export interface BlockKey {
  hash: string
  nodeType: string
}

export type BlockMatch =
  | { kind: 'unchanged'; a: number; b: number }
  | { kind: 'changed'; a: number; b: number }
  | { kind: 'removed'; a: number }
  | { kind: 'added'; b: number }

/** Longest common subsequence of the residue, walked forward so removals and
 *  insertions come out grouped in document order for the zip pass. */
const lcsMatches = (
  before: BlockKey[],
  after: BlockKey[],
  offsetA: number,
  offsetB: number,
  out: BlockMatch[]
): void => {
  const n = before.length
  const m = after.length
  const width = m + 1
  const dp = new Int32Array((n + 1) * width)

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i * width + j] =
        before[i].hash === after[j].hash
          ? dp[(i + 1) * width + j + 1] + 1
          : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1])
    }
  }

  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (before[i].hash === after[j].hash) {
      out.push({ kind: 'unchanged', a: offsetA + i, b: offsetB + j })
      i += 1
      j += 1
    } else if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) {
      out.push({ kind: 'removed', a: offsetA + i })
      i += 1
    } else {
      out.push({ kind: 'added', b: offsetB + j })
      j += 1
    }
  }
  for (; i < n; i += 1) out.push({ kind: 'removed', a: offsetA + i })
  for (; j < m; j += 1) out.push({ kind: 'added', b: offsetB + j })
}

/**
 * Plain LCS only ever says added or removed, so a one-word edit surfaces as a
 * delete next to an insert. Zip each such gap positionally into `changed`,
 * gated on node type: a paragraph swapped for an image is two events, not one.
 */
const zipAdjacentRuns = (
  matches: BlockMatch[],
  before: BlockKey[],
  after: BlockKey[]
): BlockMatch[] => {
  const out: BlockMatch[] = []
  let cursor = 0

  while (cursor < matches.length) {
    if (matches[cursor].kind === 'unchanged') {
      out.push(matches[cursor])
      cursor += 1
      continue
    }

    const removed: number[] = []
    const added: number[] = []
    let end = cursor
    while (end < matches.length && matches[end].kind !== 'unchanged') {
      const match = matches[end]
      if (match.kind === 'removed') removed.push(match.a)
      else if (match.kind === 'added') added.push(match.b)
      end += 1
    }

    const pairs = Math.min(removed.length, added.length)
    for (let k = 0; k < pairs; k += 1) {
      const a = removed[k]
      const b = added[k]
      if (before[a].nodeType === after[b].nodeType) {
        out.push({ kind: 'changed', a, b })
      } else {
        out.push({ kind: 'removed', a })
        out.push({ kind: 'added', b })
      }
    }
    for (let k = pairs; k < removed.length; k += 1) out.push({ kind: 'removed', a: removed[k] })
    for (let k = pairs; k < added.length; k += 1) out.push({ kind: 'added', b: added[k] })

    cursor = end
  }

  return out
}

/** Trim, LCS, zip. `coarse` means the residue was too large to match and the
 *  window degenerated to remove-all then add-all. */
export const matchBlocks = (
  before: BlockKey[],
  after: BlockKey[]
): { matches: BlockMatch[]; coarse: boolean } => {
  let prefix = 0
  while (
    prefix < before.length &&
    prefix < after.length &&
    before[prefix].hash === after[prefix].hash
  ) {
    prefix += 1
  }

  let suffix = 0
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix].hash === after[after.length - 1 - suffix].hash
  ) {
    suffix += 1
  }

  const residueA = before.slice(prefix, before.length - suffix)
  const residueB = after.slice(prefix, after.length - suffix)

  const raw: BlockMatch[] = []
  for (let k = 0; k < prefix; k += 1) raw.push({ kind: 'unchanged', a: k, b: k })

  const coarse = residueA.length * residueB.length > MAX_DIFF_LCS_CELLS
  if (coarse) {
    for (let k = 0; k < residueA.length; k += 1) raw.push({ kind: 'removed', a: prefix + k })
    for (let k = 0; k < residueB.length; k += 1) raw.push({ kind: 'added', b: prefix + k })
  } else {
    lcsMatches(residueA, residueB, prefix, prefix, raw)
  }

  for (let k = suffix; k > 0; k -= 1) {
    raw.push({ kind: 'unchanged', a: before.length - k, b: after.length - k })
  }

  return { matches: coarse ? raw : zipAdjacentRuns(raw, before, after), coarse }
}
