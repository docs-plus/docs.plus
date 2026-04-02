/**
 * Pure nested → flat heading migration pipeline (no database).
 *
 * Used by `src/scripts/migrate-nested-to-flat.ts`. ProseMirror rule: JSON → doc
 * requires a schema that knows every node/mark; round-trip must not reintroduce
 * legacy `contentHeading` / `contentWrapper` after transform.
 */

import { TiptapTransformer } from '@hocuspocus/transformer'
import * as Y from 'yjs'

import { migrationExtensions } from './migration-extensions'
import { isOldSchema, transformNestedToFlat } from './schema-migration'

/** Interactive transaction budget for documents with many history rows. */
export const MIGRATION_TRANSACTION_TIMEOUT_MS = 120_000
export const MIGRATION_TRANSACTION_MAX_WAIT_MS = 10_000

export type MigrationPhase =
  | 'decode_yjs'
  | 'transform'
  | 'encode_yjs'
  | 'verify_roundtrip'
  | 'post_verify'

export type RowPlan = { action: 'skip' } | { action: 'update'; bytes: Uint8Array }

export type PlanRowResult =
  | { ok: true; plan: RowPlan }
  | { ok: false; phase: MigrationPhase; error: unknown }

export function ydocToPmJson(
  data: Buffer | Uint8Array
): { ok: true; json: Record<string, unknown> } | { ok: false; error: unknown } {
  try {
    const ydoc = new Y.Doc()
    const buffer = data instanceof Buffer ? new Uint8Array(data) : data
    Y.applyUpdate(ydoc, buffer)
    const json = TiptapTransformer.fromYdoc(ydoc, 'default') as Record<string, unknown> | null
    if (json == null) {
      return { ok: false, error: new Error('TiptapTransformer.fromYdoc returned null') }
    }
    return { ok: true, json }
  } catch (error) {
    return { ok: false, error }
  }
}

export function pmJsonToYdocBytes(json: Record<string, unknown>): Uint8Array {
  const ydoc = TiptapTransformer.toYdoc(json, 'default', migrationExtensions)
  return Y.encodeStateAsUpdate(ydoc)
}

/**
 * Decode migrated bytes and ensure legacy nested-heading wrappers are gone.
 */
function verifyRoundTripAndNotNested(
  bytes: Uint8Array
): { ok: true } | { ok: false; phase: MigrationPhase; error: unknown } {
  let json: Record<string, unknown>
  try {
    const ydoc = new Y.Doc()
    Y.applyUpdate(ydoc, bytes)
    const decoded = TiptapTransformer.fromYdoc(ydoc, 'default') as Record<string, unknown> | null
    if (decoded == null) {
      return {
        ok: false,
        phase: 'verify_roundtrip',
        error: new Error('Round-trip fromYdoc returned null')
      }
    }
    json = decoded
  } catch (error) {
    return { ok: false, phase: 'verify_roundtrip', error }
  }

  if (isOldSchema(json as any)) {
    return {
      ok: false,
      phase: 'post_verify',
      error: new Error(
        'Decoded migrated state still contains contentHeading/contentWrapper; transform or schema mismatch'
      )
    }
  }

  return { ok: true }
}

/**
 * Plan migration for one stored Yjs payload. No I/O.
 * Refuses empty output when input had data (avoids wiping non-empty rows).
 */
export function planRow(data: Uint8Array): PlanRowResult {
  const inputLen = data.byteLength

  const decoded = ydocToPmJson(data)
  if (!decoded.ok) {
    return { ok: false, phase: 'decode_yjs', error: decoded.error }
  }

  if (!isOldSchema(decoded.json as any)) {
    return { ok: true, plan: { action: 'skip' } }
  }

  let flatJson: ReturnType<typeof transformNestedToFlat>
  try {
    flatJson = transformNestedToFlat(decoded.json as any)
  } catch (error) {
    return { ok: false, phase: 'transform', error }
  }

  let newBytes: Uint8Array
  try {
    newBytes = pmJsonToYdocBytes(flatJson as unknown as Record<string, unknown>)
  } catch (error) {
    return { ok: false, phase: 'encode_yjs', error }
  }

  if (inputLen > 0 && newBytes.byteLength === 0) {
    return {
      ok: false,
      phase: 'encode_yjs',
      error: new Error(
        'Refusing to persist empty Yjs update: input had bytes but encode produced zero length'
      )
    }
  }

  const nestedCheck = verifyRoundTripAndNotNested(newBytes)
  if (!nestedCheck.ok) {
    return { ok: false, phase: nestedCheck.phase, error: nestedCheck.error }
  }

  return { ok: true, plan: { action: 'update', bytes: newBytes } }
}
