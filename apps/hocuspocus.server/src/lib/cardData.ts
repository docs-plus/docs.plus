import { TOC_ID_ATTR } from '../modules/document-content/types'
import {
  graphemesOf,
  type ListKind,
  OUTLINE_MAX_BYTES,
  OUTLINE_MAX_ITEMS,
  STORED_BLOCK_LINES,
  STORED_LINE_MAX,
  type StoredBlock,
  type StoredCardData,
  type StoredOutline,
  type StoredOutlineItem
} from '../modules/social-card/domain/storedData'
import { sanitizePlainText } from './sanitizePlainText'

export type PmNode = {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  content?: PmNode[]
}

// Enough raw text for 80 graphemes after whitespace collapses; the rest is never drawn.
const RAW_TEXT_MAX = 4096
const CLEAN_MAX = STORED_LINE_MAX * 16
const LIST_KINDS: Record<string, ListKind> = {
  bulletList: 'bullet',
  orderedList: 'ordered',
  taskList: 'task'
}
/** Text of one block, iterative because a stored snapshot's depth is not bounded. */
const textOf = (node: PmNode): string => {
  let out = ''
  const stack: PmNode[] = [node]
  while (stack.length > 0 && out.length < RAW_TEXT_MAX) {
    const next = stack.pop() as PmNode
    if (typeof next.text === 'string') out += next.text
    else if (next.type === 'hardBreak') out += ' '
    else if (Array.isArray(next.content)) {
      for (let i = next.content.length - 1; i >= 0; i -= 1) stack.push(next.content[i])
    }
  }
  return out
}

/** One stored line: cleaned, then cut to `STORED_LINE_MAX` graphemes with "…". */
export const storedLine = (raw: string): string => {
  const clean = sanitizePlainText(raw, CLEAN_MAX)
  const parts = graphemesOf(clean)
  const cutShort = clean.length === CLEAN_MAX
  if (!cutShort && parts.length <= STORED_LINE_MAX) return clean
  const keep = Math.min(cutShort ? parts.length - 1 : parts.length, STORED_LINE_MAX - 1)
  return `${parts.slice(0, keep).join('').trimEnd()}…`
}

const blockLine = (node: PmNode): string =>
  storedLine(node.type === 'blockquote' ? (node.content ?? []).map(textOf).join(' ') : textOf(node))

/** Paragraphs, quotes and lists in `nodes[start, end)`, up to `STORED_BLOCK_LINES` lines. */
const blocksIn = (nodes: PmNode[], start: number, end: number): StoredBlock[] => {
  const blocks: StoredBlock[] = []
  let lines = 0
  for (let i = start; i < end && lines < STORED_BLOCK_LINES; i += 1) {
    const node = nodes[i]
    if (node.type === 'paragraph' || node.type === 'blockquote') {
      const text = blockLine(node)
      if (text) {
        blocks.push({ kind: 'paragraph', text })
        lines += 1
      }
      continue
    }
    const list = LIST_KINDS[node.type ?? '']
    if (!list) continue
    const items: { text: string; checked?: boolean }[] = []
    for (const item of node.content ?? []) {
      if (lines + items.length >= STORED_BLOCK_LINES) break
      const first = item.content?.[0]
      const text = first ? storedLine(textOf(first)) : ''
      if (!text) continue
      items.push(
        list === 'task' && item.attrs?.checked === true ? { text, checked: true } : { text }
      )
    }
    if (items.length > 0) {
      blocks.push({ kind: 'list', list, items })
      lines += items.length
    }
  }
  return blocks
}

const tocIdOf = (node: PmNode): string | null => {
  const id = node.attrs?.[TOC_ID_ATTR]
  return typeof id === 'string' && id.length > 0 ? id : null
}

// Stored attrs are stranger-written, so an odd level must not break the tree.
const levelOf = (node: PmNode): number => {
  const level = Number(node.attrs?.level)
  return Number.isInteger(level) ? Math.min(6, Math.max(1, level)) : 1
}

const titleTextOf = (title: PmNode | null): string | null =>
  title ? storedLine(textOf(title)) || null : null

const outlineOf = (nodes: PmNode[], start: number, title: PmNode | null): StoredOutline => {
  const titleId = title ? tocIdOf(title) : null
  // A repeated id resolves to its first heading, so a later copy is left out.
  const seen = new Set(titleId ? [titleId] : [])
  const items: StoredOutlineItem[] = []
  const open: { level: number; index: number }[] = []
  let truncated = false

  for (let i = start; i < nodes.length; i += 1) {
    const node = nodes[i]
    if (node.type !== 'heading') continue
    // The id checks come first: the text work cost 0.9 s on 20,000 headings with no id.
    const id = tocIdOf(node)
    if (!id || seen.has(id)) continue
    const text = storedLine(textOf(node))
    if (!text) continue
    if (items.length >= OUTLINE_MAX_ITEMS) {
      truncated = true
      break
    }
    seen.add(id)
    const level = levelOf(node)
    while (open.length > 0 && open[open.length - 1].level >= level) open.pop()
    let end = i + 1
    while (end < nodes.length && nodes[end].type !== 'heading') end += 1
    items.push({
      id,
      level,
      text,
      parent: open.at(-1)?.index ?? -1,
      blocks: blocksIn(nodes, i + 1, end)
    })
    open.push({ level, index: items.length - 1 })
  }

  return {
    title: titleTextOf(title),
    titleId,
    ...(truncated ? { truncated: true as const } : {}),
    items
  }
}

const fits = (outline: StoredOutline): boolean =>
  Buffer.byteLength(JSON.stringify(outline)) <= OUTLINE_MAX_BYTES

/** Too big: the section blocks go first, so the Heading card loses its lines before its title. */
const boundedOutline = (outline: StoredOutline): StoredOutline | null => {
  if (fits(outline)) return outline
  const bare = { ...outline, items: outline.items.map((item) => ({ ...item, blocks: [] })) }
  return fits(bare) ? bare : null
}

const topNodes = (json: unknown): PmNode[] => {
  const root = json as { content?: unknown } | null
  return (Array.isArray(root?.content) ? root.content : []).filter(
    (node): node is PmNode => typeof node === 'object' && node !== null
  )
}

/** The Title is `content[0]` when that node is a heading. */
const titleNodeOf = (nodes: PmNode[]): PmNode | null =>
  nodes[0]?.type === 'heading' ? nodes[0] : null

/** One snapshot's Title text, cut like every stored line. The version change summary reads it too. */
export const titleOf = (json: unknown): string | null => titleTextOf(titleNodeOf(topNodes(json)))

/** The first blocks and the outline from one decoded snapshot. */
export const cardDataFromPmJson = (json: unknown): StoredCardData => {
  const nodes = topNodes(json)
  const title = titleNodeOf(nodes)
  const start = title ? 1 : 0
  return {
    v: 1,
    blocks: blocksIn(nodes, start, nodes.length),
    outline: boundedOutline(outlineOf(nodes, start, title))
  }
}
