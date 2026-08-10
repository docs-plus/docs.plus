import { getSchema } from '@tiptap/core'
import type { Node as PMNode, Schema } from '@tiptap/pm/model'

import { migrationExtensions } from '../../../lib/migration-extensions'
import { ydocToPmJson } from '../../../lib/nested-flat-migration'
import type { BlockChange, BlockDiff, VersionSnapshot } from '../types'
import { DIFF_PREVIEW_CHARS, MAX_DIFF_CHANGES } from '../types'
import { collectBlockClientIds } from './blockAuthors'
import { canonicalizeBlock } from './canonicalizeBlock'
import { type BlockKey, matchBlocks } from './matchBlocks'

// Built lazily: the module must have no top-level side effects, and every
// snapshot on both sides of a diff is read through this one schema.
let diffSchema: Schema | null = null
const getDiffSchema = (): Schema => (diffSchema ??= getSchema(migrationExtensions))

/** Positions, not characters: a block boundary costs two positions per
 *  newline. The doubled window always covers the preview and never
 *  materialises a whole task list as a string. */
const preview = (node: PMNode): string =>
  node
    .textBetween(0, Math.min(node.content.size, DIFF_PREVIEW_CHARS * 2 + 1), '\n')
    .slice(0, DIFF_PREVIEW_CHARS)

interface DecodedSide {
  doc: PMNode
  keys: BlockKey[]
  /** Doc-relative start position of each top-level child. */
  starts: number[]
}

const decodeSide = (snapshot: VersionSnapshot): DecodedSide => {
  const decoded = ydocToPmJson(snapshot.data)
  if (!decoded.ok) throw decoded.error

  const doc = getDiffSchema().nodeFromJSON(decoded.json)
  const keys: BlockKey[] = []
  const starts: number[] = []
  let offset = 0

  doc.forEach((child) => {
    keys.push({
      hash: JSON.stringify(canonicalizeBlock(child.toJSON())),
      nodeType: child.type.name
    })
    starts.push(offset)
    offset += child.nodeSize
  })

  return { doc, keys, starts }
}

/**
 * Block-level edit script between two stored snapshots. Pure and synchronous:
 * no database, no editor view, literal bytes in and JSON out. Undecodable bytes
 * fail closed rather than reporting a document that rewrote itself.
 */
export const diffBlocks = (
  before: VersionSnapshot | null,
  after: VersionSnapshot
): { ok: true; diff: BlockDiff } | { ok: false; error: unknown } => {
  let afterSide: DecodedSide
  let beforeSide: DecodedSide | null
  let blockClientIds: ReturnType<typeof collectBlockClientIds>
  try {
    afterSide = decodeSide(after)
    beforeSide = before === null ? null : decodeSide(before)
    // Inside the guard: the author walk decodes the same hostile bytes, and a
    // throw here has to read back as `{ ok: false }` like every other failure.
    blockClientIds = collectBlockClientIds(after.data, afterSide.doc)
  } catch (error) {
    return { ok: false, error }
  }
  const beforeKeys = beforeSide?.keys ?? []
  const { matches, coarse } = matchBlocks(beforeKeys, afterSide.keys)

  const changes: BlockChange[] = []
  let totalChanges = 0

  for (const match of matches) {
    if (match.kind === 'unchanged') continue
    totalChanges += 1
    if (changes.length >= MAX_DIFF_CHANGES) continue

    if (match.kind === 'removed') {
      const node = (beforeSide as DecodedSide).doc.child(match.a)
      changes.push({
        kind: 'removed',
        index: match.a,
        nodeType: node.type.name,
        before: preview(node),
        clientIds: []
      })
      continue
    }

    const node = afterSide.doc.child(match.b)
    const from = afterSide.starts[match.b]
    changes.push({
      kind: match.kind,
      index: match.b,
      nodeType: node.type.name,
      from,
      to: from + node.nodeSize,
      ...(match.kind === 'changed'
        ? { before: preview((beforeSide as DecodedSide).doc.child(match.a)) }
        : {}),
      after: preview(node),
      clientIds: blockClientIds?.[match.b] ?? []
    })
  }

  return {
    ok: true,
    diff: {
      fromVersion: before?.version ?? 0,
      toVersion: after.version,
      blocksBefore: beforeKeys.length,
      blocksAfter: afterSide.keys.length,
      changes,
      totalChanges,
      coarse,
      unattributed: blockClientIds === null
    }
  }
}
