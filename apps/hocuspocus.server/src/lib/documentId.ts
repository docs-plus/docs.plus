import { createHash } from 'node:crypto'

// Base62 and 19 chars because a documentId is substitutable for `ShortUniqueId.stamp(19)`
// everywhere it is already stored, and `lower(documentId)` lands in `workspaces.slug`,
// CHECKed against `^[a-z0-9]+(?:-[a-z0-9]+)*$`. Base64url would fail that on `_`.
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const ID_LENGTH = 19

// The epoch a slug derives at before its first purge. "No epoch row" and this
// value are the same state, so the row may never be pruned back to absent.
export const INITIAL_EPOCH = 1

/**
 * Derive a draft's documentId from its slug, so two people opening the same new
 * slug at once land in one Yjs room instead of forking into two documents.
 * The epoch changes on purge; without it a reused slug would derive the erased
 * document's id and a stale IndexedDB mirror could sync its content back.
 */
export function deriveDocumentId(normalizedSlug: string, epoch: number): string {
  const digest = createHash('sha256').update(`${normalizedSlug}#${epoch}`).digest()

  let value = 0n
  for (const byte of digest) value = (value << 8n) | BigInt(byte)

  const base = BigInt(ALPHABET.length)
  let id = ''
  while (id.length < ID_LENGTH) {
    id += ALPHABET[Number(value % base)]
    value /= base
  }
  return id
}
