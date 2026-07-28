import { VOLATILE_BLOCK_ATTRS } from '../types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Sorted, null-free, volatile-free. Returns undefined when nothing survives so
 *  the caller drops the key: `{}` and absent must hash the same. */
const canonicalizeAttrs = (attrs: Record<string, unknown>): Record<string, unknown> | undefined => {
  const keys = Object.keys(attrs)
    .filter((key) => !VOLATILE_BLOCK_ATTRS.has(key) && attrs[key] !== null)
    .sort()
  if (keys.length === 0) return undefined

  const out: Record<string, unknown> = {}
  for (const key of keys) out[key] = canonicalizeBlock(attrs[key])
  return out
}

/**
 * Stable hash source for one ProseMirror JSON node. Rewrites attrs only, never
 * structure: dropping or reordering children would shift the positions the diff
 * reports back against the live document.
 */
export const canonicalizeBlock = (node: unknown): unknown => {
  if (Array.isArray(node)) return node.map(canonicalizeBlock)
  if (!isRecord(node)) return node

  const out: Record<string, unknown> = {}
  for (const key of Object.keys(node).sort()) {
    const value = node[key]
    if (key === 'attrs' && isRecord(value)) {
      const attrs = canonicalizeAttrs(value)
      if (attrs !== undefined) out.attrs = attrs
      continue
    }
    out[key] = canonicalizeBlock(value)
  }
  return out
}
