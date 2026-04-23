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

/**
 * Truncate so the returned string is at most `max` chars including the
 * trailing ellipsis. Cuts at `max - ELLIPSIS.length` then appends `...`.
 * Returns the original string unchanged when it already fits.
 */
export function truncateSegment(text: string, max: number = SEGMENT_MAX_LENGTH): string {
  if (text.length <= max) return text
  return text.slice(0, max - ELLIPSIS.length) + ELLIPSIS
}

/**
 * Format one heading entry as a breadcrumb segment.
 * Empty / whitespace-only heading text falls back to `Heading N`.
 * Result is truncated to SEGMENT_MAX_LENGTH (incl. ellipsis).
 */
export function formatHeadingSegment(entry: HeadingEntry): string {
  const trimmed = entry.text.trim()
  const raw = trimmed.length > 0 ? trimmed : `Heading ${entry.level}`
  return truncateSegment(raw, SEGMENT_MAX_LENGTH)
}

/**
 * Build the ancestor heading chain (in display order) for a cursor that
 * sits after `precedingHeadings`. The schema is flat (`heading block*`),
 * so hierarchy is implicit from heading level.
 *
 * Algorithm: walk preceding headings in REVERSE, accept a heading only
 * if its level is strictly less than the current `requiredLevel`, then
 * tighten `requiredLevel` to that heading's level. Stop at level 1.
 *
 * @param precedingHeadings - All headings before the cursor, in document order.
 * @param currentHeadingLevel - The cursor's own heading level (1-6) when the
 *   current node IS a heading, else `null`. Used to seed `requiredLevel` so
 *   sibling/lower headings of the same level are not treated as ancestors.
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

/**
 * Resolve the trailing breadcrumb segment from the current node's role.
 * Uses PLACEHOLDER_TEXT for the generic per-node strings; headings get
 * `Heading N` (with the level) so the user sees what they're about to write.
 */
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
 * Lightweight reference to a heading: just its level and the node itself.
 * We defer reading `textContent` until after the ancestor chain is selected
 * so we only pay the text-walk cost for the (≤ 6) headings we actually
 * render, not for every preceding heading in the document.
 */
interface HeadingRef {
  level: number
  node: PlaceholderRenderProps['node']
}

function collectPrecedingHeadingRefs(
  doc: PlaceholderRenderProps['editor']['state']['doc'],
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
 * Legacy placeholder used outside the breadcrumb's reach: container-gated
 * label first (paragraph-only, matching the pre-breadcrumb behavior), then
 * the generic per-node placeholder.
 */
function legacyPlaceholder(nodeName: string, parentName: string): string {
  if (nodeName === 'paragraph' && parentName in PARENT_PLACEHOLDER) {
    return PARENT_PLACEHOLDER[parentName]
  }
  return PLACEHOLDER_TEXT[nodeName] ?? ''
}

/**
 * Decide whether a breadcrumb should render for the current empty node.
 *
 * - 'all-blocks' shows the breadcrumb wherever the placeholder fires.
 * - 'top-level' restricts it to paragraphs and headings whose parent is the
 *   document root, preserving the legacy `List` / `Quote` / `Write code`
 *   placeholders inside containers and code blocks.
 *
 * The first H1 is special-cased upstream and never reaches this function.
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
  const { editor, node, pos, parentName } = props
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

  const precedingRefs = collectPrecedingHeadingRefs(editor.state.doc, pos)
  const chainRefs = buildAncestorChain(precedingRefs, isHeading ? (headingLevel ?? null) : null)
  const tail = resolveTailSegment({ nodeName, headingLevel, isSubtitle })

  // Materialize textContent only for the (≤ 6) headings we actually render.
  const segments = chainRefs.map((ref) =>
    formatHeadingSegment({ level: ref.level, text: ref.node.textContent })
  )
  if (tail) segments.push(tail)

  return segments.join(SEGMENT_SEPARATOR)
}
