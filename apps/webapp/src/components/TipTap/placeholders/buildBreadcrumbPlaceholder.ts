import type { PlaceholderRenderProps } from '@docs.plus/extension-placeholder'

export type BreadcrumbScope = 'top-level' | 'all-blocks'

export interface BreadcrumbPlaceholderOptions {
  /** Where the breadcrumb should appear. Default: 'top-level'. */
  scope?: BreadcrumbScope
}

export interface HeadingEntry {
  level: number
  text: string
}

const PLACEHOLDER_TEXT: Record<string, string> = {
  heading: 'Heading',
  paragraph: 'Write here',
  codeBlock: 'Write code'
}

const PARENT_PLACEHOLDER: Record<string, string> = {
  listItem: 'List',
  taskItem: 'To-do',
  blockquote: 'Quote'
}

const SEGMENT_MAX_LENGTH = 24
const SEGMENT_SEPARATOR = ' > '
const ELLIPSIS = '...'

/** `max` counts the trailing ellipsis, so the result never exceeds it. */
export function truncateSegment(text: string, max: number = SEGMENT_MAX_LENGTH): string {
  if (text.length <= max) return text
  return text.slice(0, max - ELLIPSIS.length) + ELLIPSIS
}

/** Empty or whitespace-only heading text falls back to `Heading N`. */
export function formatHeadingSegment(entry: HeadingEntry): string {
  const trimmed = entry.text.trim()
  const raw = trimmed.length > 0 ? trimmed : `Heading ${entry.level}`
  return truncateSegment(raw, SEGMENT_MAX_LENGTH)
}

/**
 * The schema is flat (`heading block*`), so hierarchy is implicit from level.
 * Walk `precedingHeadings` (document order) in reverse and keep each heading
 * shallower than the last kept one. `currentHeadingLevel` seeds that bound so
 * siblings at the cursor's own level are not mistaken for ancestors.
 */
export function buildAncestorChain<T extends { level: number }>(
  precedingHeadings: T[],
  currentHeadingLevel: number | null
): T[] {
  const chain: T[] = []
  let requiredLevel = currentHeadingLevel ?? Number.POSITIVE_INFINITY

  for (let i = precedingHeadings.length - 1; i >= 0; i--) {
    const heading = precedingHeadings[i]
    if (heading.level < requiredLevel) {
      chain.push(heading)
      requiredLevel = heading.level
      if (requiredLevel === 1) break
    }
  }

  return chain.reverse()
}

interface TailContext {
  nodeName: string
  headingLevel?: number
  isSubtitle?: boolean
}

/** Headings carry their level (`Heading N`) so the user sees what they're about to write. */
export function resolveTailSegment(ctx: TailContext): string {
  if (ctx.nodeName === 'heading' && typeof ctx.headingLevel === 'number') {
    return `Heading ${ctx.headingLevel}`
  }
  if (ctx.nodeName === 'paragraph' && ctx.isSubtitle) {
    return 'Subtitle'
  }
  return PLACEHOLDER_TEXT[ctx.nodeName] ?? ''
}

/**
 * Holds the node, not its text. `textContent` is read only after the ancestor
 * chain is picked. The text-walk cost is therefore paid for the ≤ 6 headings
 * actually rendered, not every preceding heading in the document.
 */
interface HeadingRef {
  level: number
  node: PlaceholderRenderProps['node']
}

function collectPrecedingHeadingRefs(
  doc: PlaceholderRenderProps['doc'],
  pos: number
): HeadingRef[] {
  // resolve(pos).index(0) gives the index of the top-level child that
  // CONTAINS pos. We want everything strictly before that index.
  const topIndex = doc.resolve(pos).index(0)
  const refs: HeadingRef[] = []
  for (let i = 0; i < topIndex; i++) {
    const child = doc.child(i)
    if (child.type.name === 'heading') {
      const level = (child.attrs as { level?: number }).level ?? 1
      refs.push({ level, node: child })
    }
  }
  return refs
}

/**
 * Used outside the breadcrumb's reach. The container-gated label stays
 * paragraph-only, matching the pre-breadcrumb behavior.
 */
function legacyPlaceholder(nodeName: string, parentName: string): string {
  if (nodeName === 'paragraph' && parentName in PARENT_PLACEHOLDER) {
    return PARENT_PLACEHOLDER[parentName]
  }
  return PLACEHOLDER_TEXT[nodeName] ?? ''
}

/**
 * 'top-level' keeps the breadcrumb off nested blocks so the legacy `List` /
 * `Quote` / `Write code` placeholders survive inside containers and code
 * blocks. The first H1 is special-cased upstream and never reaches here.
 */
function shouldRenderBreadcrumb(
  scope: BreadcrumbScope,
  nodeName: string,
  parentName: string
): boolean {
  if (scope === 'all-blocks') return true
  const supportsBreadcrumb = nodeName === 'paragraph' || nodeName === 'heading'
  return supportsBreadcrumb && parentName === 'doc'
}

export function buildBreadcrumbPlaceholder(
  props: PlaceholderRenderProps,
  options: BreadcrumbPlaceholderOptions = {}
): string {
  const { node, pos, parentName, doc } = props
  const scope = options.scope ?? 'top-level'
  const nodeName = node.type.name

  if (nodeName === 'heading' && pos === 0) {
    return 'Enter document name'
  }

  if (!shouldRenderBreadcrumb(scope, nodeName, parentName)) {
    return legacyPlaceholder(nodeName, parentName)
  }

  const isHeading = nodeName === 'heading'
  const headingLevel = isHeading ? ((node.attrs as { level?: number }).level ?? 1) : undefined
  const isSubtitle =
    nodeName === 'paragraph' &&
    (node.attrs as { paragraphStyle?: string | null }).paragraphStyle === 'subtitle'

  const precedingRefs = collectPrecedingHeadingRefs(doc, pos)
  const chainRefs = buildAncestorChain(precedingRefs, isHeading ? (headingLevel ?? null) : null)
  const tail = resolveTailSegment({ nodeName, headingLevel, isSubtitle })

  // Materialize textContent only for the (≤ 6) headings we actually render.
  const segments = chainRefs.map((ref) =>
    formatHeadingSegment({ level: ref.level, text: ref.node.textContent })
  )
  if (tail) segments.push(tail)

  return segments.join(SEGMENT_SEPARATOR)
}
