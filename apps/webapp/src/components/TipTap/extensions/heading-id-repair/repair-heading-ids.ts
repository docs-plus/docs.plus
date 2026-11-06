import type { XmlElement, XmlFragment, XmlHook, XmlText } from 'yjs'

/** One top-level block of the shared document, as the repair plan reads it. */
export interface RepairBlock {
  heading: boolean
  level: number
  /** The heading's `toc-id`. Null and empty ids never take part. */
  id: string | null
  /** Equality text of the whole block. Read only for a block in a duplicated set. */
  key: () => string
  /** The Yjs item id of the block, which every peer sees the same. */
  client: number
  clock: number
}

export interface HeadingIdRepairPlan {
  /** Block indexes to delete, in ascending order. */
  deletes: number[]
  rekeys: { index: number; id: string }[]
}

export interface DuplicateHeadingIds {
  /** How many ids appear on more than one top-level heading. */
  duplicateIds: number
  /** How many headings beyond the first carry such an id. */
  extraCopies: number
}

/** Counts only, never text, so the report carries no document content. */
export function countDuplicateIds(ids: readonly (string | null)[]): DuplicateHeadingIds | null {
  const counts = new Map<string, number>()
  for (const id of ids) if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
  let duplicateIds = 0
  let extraCopies = 0
  for (const n of counts.values()) {
    if (n < 2) continue
    duplicateIds++
    extraCopies += n - 1
  }
  return duplicateIds ? { duplicateIds, extraCopies } : null
}

const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const ID_LENGTH = 16

// cyrb53: a 53-bit string hash. Each seed fills 8 base62 chars (62^8 < 2^53).
function cyrb53(text: string, seed: number): number {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

function base62(value: number, length: number): string {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += ID_ALPHABET[value % 62]
    value = Math.floor(value / 62)
  }
  return out
}

/**
 * A new `toc-id` for a re-keyed copy. Every peer derives the same value from the
 * copy's Yjs item id. 16 base62 chars, the shape of `stamp(16)`, fits `varchar(36)`.
 */
export function repairedHeadingId(
  id: string,
  client: number,
  clock: number,
  taken: ReadonlySet<string> = new Set()
): string {
  for (let attempt = 0; ; attempt++) {
    const text = `${id}:${client}:${clock}${attempt ? `:${attempt}` : ''}`
    const out = base62(cyrb53(text, 1), ID_LENGTH / 2) + base62(cyrb53(text, 2), ID_LENGTH / 2)
    if (!taken.has(out)) return out
  }
}

const hasId = (b: RepairBlock) => b.heading && !!b.id

/**
 * Pure and deterministic, so two peers on the same state write the same change.
 * Pass 1 (twin rule): a bare heading goes when the next block is an equal heading.
 * Pass 2: the first copy owns the id. An equal later set goes; a different one is re-keyed.
 */
export function planHeadingIdRepair(blocks: readonly RepairBlock[]): HeadingIdRepairPlan {
  const plan: HeadingIdRepairPlan = { deletes: [], rekeys: [] }
  if (!countDuplicateIds(blocks.filter(hasId).map((b) => b.id))) return plan

  const keys = new Map<number, string>()
  const keyOf = (i: number) => {
    if (!keys.has(i)) keys.set(i, blocks[i].key())
    return keys.get(i)!
  }

  const deleted = new Set<number>()
  for (let i = 0; i + 1 < blocks.length; i++) {
    const next = blocks[i + 1]
    if (hasId(blocks[i]) && next.heading && next.id === blocks[i].id && keyOf(i) === keyOf(i + 1)) {
      deleted.add(i)
    }
  }

  // Sets are read over the blocks left after pass 1.
  const live = blocks.map((_, i) => i).filter((i) => !deleted.has(i))
  const setEnd = (at: number) => {
    const { level } = blocks[live[at]]
    let end = at + 1
    while (end < live.length && !(blocks[live[end]].heading && blocks[live[end]].level <= level)) {
      end++
    }
    return end
  }
  const sameSet = (a: number, b: number) => {
    const aEnd = setEnd(a)
    const bEnd = setEnd(b)
    if (aEnd - a !== bEnd - b) return false
    for (let k = 0; k < aEnd - a; k++) if (keyOf(live[a + k]) !== keyOf(live[b + k])) return false
    return true
  }

  const taken = new Set(blocks.filter(hasId).map((b) => b.id!))
  const owners = new Map<string, number>()
  for (let at = 0; at < live.length; at++) {
    const block = blocks[live[at]]
    if (!hasId(block)) continue
    const owner = owners.get(block.id!)
    if (owner === undefined) {
      owners.set(block.id!, at)
      continue
    }
    if (sameSet(owner, at)) {
      const end = setEnd(at)
      for (let k = at; k < end; k++) deleted.add(live[k])
      at = end - 1
      continue
    }
    const id = repairedHeadingId(block.id!, block.client, block.clock, taken)
    taken.add(id)
    plan.rekeys.push({ index: live[at], id })
  }

  plan.deletes = [...deleted].sort((a, b) => a - b)
  return plan
}

const isElement = (node: XmlElement | XmlText | XmlHook): node is XmlElement => 'nodeName' in node

export function readRepairBlocks(fragment: XmlFragment): RepairBlock[] {
  return fragment.toArray().map((node) => {
    const element = isElement(node) ? node : null
    const heading = element?.nodeName === 'heading'
    const id = heading ? element!.getAttribute('toc-id') : null
    const itemId = node._item?.id
    return {
      heading,
      level: heading ? Number(element!.getAttribute('level')) : 0,
      id: typeof id === 'string' && id !== '' ? id : null,
      key: () => node.toString(),
      client: itemId?.client ?? 0,
      clock: itemId?.clock ?? 0
    }
  })
}

/**
 * Writes the plan straight into the shared fragment, in one Yjs transaction under
 * `origin`. Never through a ProseMirror dispatch: that copy was measured to duplicate
 * a re-keyed set when two peers repaired at once. Returns whether it wrote.
 */
export function repairHeadingIds(fragment: XmlFragment, origin: unknown): boolean {
  const plan = planHeadingIdRepair(readRepairBlocks(fragment))
  if (!plan.deletes.length && !plan.rekeys.length) return false
  const nodes = fragment.toArray()
  fragment.doc!.transact(() => {
    for (const { index, id } of plan.rekeys) (nodes[index] as XmlElement).setAttribute('toc-id', id)
    for (let k = plan.deletes.length - 1; k >= 0; k--) fragment.delete(plan.deletes[k], 1)
  }, origin)
  return true
}
