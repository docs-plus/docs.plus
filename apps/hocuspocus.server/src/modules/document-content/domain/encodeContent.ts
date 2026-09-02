import { TiptapTransformer } from '@hocuspocus/transformer'
import ShortUniqueId from 'short-unique-id'

import { isRecord } from '../../../lib/isRecord'
import { getMigrationSchema, migrationExtensions } from '../../../lib/migration-extensions'
import type { EncodeOutcome, TiptapDocJson } from '../types'
import { MAX_CONTENT_DEPTH, MAX_CONTENT_NODES } from '../types'

// UniqueID also stamps the hyperlink mark, but nothing reads a hyperlink's
// toc-id and this walk visits nodes only — do not "fix" it by descending marks.
const TOC_ID_NODE_TYPES = new Set(['heading', 'table'])
const TOC_ID_ATTR = 'toc-id'
/** Bounded so the hand-rolled 422 envelope cannot leak a stack or a serialized error. */
const MAX_DETAIL_CHARS = 500

export const TITLE_HEADING_DETAIL = 'document content must start with a level-1 heading'

// The webapp's UniqueID stamps toc-ids once per mount, on the provider's first
// synced transaction, and never from remote updates. Content injected mid-session
// would therefore stay unaddressable: invisible to the TOC, heading chat, folds
// and `?id=` deep links, and unhealable on a readOnly document.
const tocIdGenerator = new ShortUniqueId()

const boundedDetail = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).slice(0, MAX_DETAIL_CHARS)

const invalid = (detail: string): EncodeOutcome => ({
  ok: false,
  reason: 'invalid-content',
  detail
})

/** docs.plus documents are title-first; a heading-less body makes the webapp's Fitter synthesize one. */
export const startsWithTitleHeading = (content: unknown): boolean => {
  if (!Array.isArray(content)) return false
  const first = content[0]
  if (!isRecord(first) || first.type !== 'heading') return false
  const attrs = isRecord(first.attrs) ? first.attrs : {}
  return attrs.level === 1
}

/**
 * One iterative pass: bounds the payload and stamps missing/duplicate toc-ids.
 * Explicit stack, never recursion — the walk must not overflow on the very
 * input it exists to reject.
 */
const boundAndStampIdentity = (
  root: Record<string, unknown>,
  enforceSizeCaps: boolean
): { ok: true } | { ok: false; detail: string } => {
  const seenTocIds = new Set<string>()
  const stack: { node: Record<string, unknown>; depth: number }[] = [{ node: root, depth: 0 }]
  let nodes = 0

  while (stack.length > 0) {
    const { node, depth } = stack.pop() as { node: Record<string, unknown>; depth: number }

    nodes += 1
    if (enforceSizeCaps && nodes > MAX_CONTENT_NODES) {
      return { ok: false, detail: `content exceeds MAX_CONTENT_NODES (${MAX_CONTENT_NODES})` }
    }
    if (enforceSizeCaps && depth > MAX_CONTENT_DEPTH) {
      return { ok: false, detail: `content exceeds MAX_CONTENT_DEPTH (${MAX_CONTENT_DEPTH})` }
    }

    if (typeof node.type === 'string' && TOC_ID_NODE_TYPES.has(node.type)) {
      const attrs = isRecord(node.attrs) ? node.attrs : {}
      const current = attrs[TOC_ID_ATTR]
      // A duplicate the server ships is permanent, because the webapp's dedupe
      // branch is inert on a collaboration provider. Two headings would then share
      // one chat channel, one fold id and one comment anchor forever.
      const id =
        typeof current === 'string' && current.length > 0 && !seenTocIds.has(current)
          ? current
          : tocIdGenerator.stamp(16)
      attrs[TOC_ID_ATTR] = id
      node.attrs = attrs
      seenTocIds.add(id)
    }

    const children = node.content
    if (!Array.isArray(children)) continue
    // Pushed in reverse so the LIFO stack pops siblings in document order. The
    // rule "first occurrence keeps the id" has to mean first as the reader sees it.
    for (let i = children.length - 1; i >= 0; i -= 1) {
      const child = children[i]
      if (isRecord(child)) stack.push({ node: child, depth: depth + 1 })
    }
  }

  return { ok: true }
}

/** Never throws: every rejection is `invalid-content`. */
export const encodeContent = (
  payload: TiptapDocJson,
  options: {
    requireTitleHeading: boolean
    /**
     * Off for restore: those bytes were already stored, and live editing has
     * no cap. Enforcing them there would make an oversized document unrestorable.
     * Structural checks still run. Default on.
     */
    enforceSizeCaps?: boolean
  }
): EncodeOutcome => {
  const bounded = boundAndStampIdentity(
    payload as unknown as Record<string, unknown>,
    options.enforceSizeCaps ?? true
  )
  if (!bounded.ok) return invalid(bounded.detail)

  if (options.requireTitleHeading && !startsWithTitleHeading(payload.content)) {
    return invalid(TITLE_HEADING_DETAIL)
  }

  try {
    // `toYdoc` uses Node.fromJSON, which never checks content expressions.
    // Heading-in-paragraph and taskItem-at-root encode and round-trip cleanly. The
    // first browser to open the doc then deletes the subtree (y-tiptap) or
    // hard-freezes on enableContentCheck. `.check()` is the only gate for that.
    getMigrationSchema().nodeFromJSON(payload).check()
    const scratch = TiptapTransformer.toYdoc(payload, 'default', migrationExtensions)
    if (TiptapTransformer.fromYdoc(scratch, 'default') == null) {
      return invalid('content did not survive a Yjs round-trip')
    }
    return { ok: true, scratch }
  } catch (error) {
    return invalid(boundedDetail(error))
  }
}
