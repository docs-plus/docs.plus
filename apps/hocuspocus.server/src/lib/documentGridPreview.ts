import { TiptapTransformer } from '@hocuspocus/transformer'
import type { PrismaClient } from '@prisma/client'
import * as Y from 'yjs'

import { dbLogger } from './logger'
import { sanitizePlainText } from './sanitizePlainText'

export type DocumentGridPreview = {
  heading: string | null
  lines: string[]
  list?: string[]
  imageSrc?: string
}

export const EMPTY_DOCUMENT_GRID_PREVIEW: DocumentGridPreview = {
  heading: null,
  lines: []
}

const LINE_MAX = 80
const MAX_LINES = 4
const MAX_LIST = 3

const IMAGE_TYPES = new Set(['image', 'Image'])
const LIST_TYPES = new Set(['bulletList', 'orderedList', 'taskList'])
const EMBED_TYPES = new Set(['youtube', 'vimeo', 'video', 'audio', 'twitter', 'iframe'])

type PmNode = {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  content?: PmNode[]
}

const nodeText = (node: PmNode): string => {
  if (typeof node.text === 'string') return node.text
  if (!Array.isArray(node.content)) return ''
  return node.content.map(nodeText).join('')
}

const isOwnHouseImageSrc = (src: string, documentId: string): boolean => {
  // eslint-disable-next-line no-control-regex
  const collapsed = src.replace(/[\u0000-\u0020]+/g, '')
  if (/^(javascript|data|vbscript|file|blob):/i.test(collapsed)) return false
  if (!/^https?:\/\//i.test(src)) return false
  return src.includes(`/plugins/hypermultimedia/${documentId}/`)
}

const imageSrcFromNode = (node: PmNode, documentId: string): string | undefined => {
  if (node.type && EMBED_TYPES.has(node.type)) return undefined
  if (!node.type || !IMAGE_TYPES.has(node.type)) return undefined
  const src = node.attrs?.src
  if (typeof src !== 'string' || !isOwnHouseImageSrc(src, documentId)) return undefined
  return src
}

const findImageSrc = (node: PmNode, documentId: string): string | undefined => {
  const own = imageSrcFromNode(node, documentId)
  if (own) return own
  if (!Array.isArray(node.content)) return undefined
  for (const child of node.content) {
    const found = findImageSrc(child, documentId)
    if (found) return found
  }
  return undefined
}

const listItems = (node: PmNode): string[] => {
  if (!Array.isArray(node.content)) return []
  const items: string[] = []
  for (const child of node.content) {
    if (items.length >= MAX_LIST) break
    const text = sanitizePlainText(nodeText(child), LINE_MAX)
    if (text) items.push(text)
  }
  return items
}

/** SQL NULL stays null (never extracted). Anything else becomes a typed preview. */
export const parseDocumentGridPreview = (value: unknown): DocumentGridPreview | null => {
  if (value == null) return null
  if (typeof value !== 'object' || Array.isArray(value)) return { ...EMPTY_DOCUMENT_GRID_PREVIEW }

  const rec = value as Record<string, unknown>
  const heading = typeof rec.heading === 'string' ? rec.heading : null
  const lines = Array.isArray(rec.lines)
    ? rec.lines.filter((line): line is string => typeof line === 'string')
    : []
  const preview: DocumentGridPreview = { heading, lines }
  if (Array.isArray(rec.list)) {
    const list = rec.list.filter((item): item is string => typeof item === 'string')
    if (list.length > 0) preview.list = list
  }
  if (typeof rec.imageSrc === 'string' && rec.imageSrc) preview.imageSrc = rec.imageSrc
  return preview
}

export const previewFromPmJson = (
  json: unknown,
  options: { documentId: string }
): DocumentGridPreview => {
  const root = json as { content?: unknown } | null
  if (!root || !Array.isArray(root.content)) return { ...EMPTY_DOCUMENT_GRID_PREVIEW }

  let heading: string | null = null
  const lines: string[] = []
  let list: string[] | undefined
  let imageSrc: string | undefined

  for (const raw of root.content) {
    if (!raw || typeof raw !== 'object') continue
    const node = raw as PmNode
    const type = node.type ?? ''

    if (type === 'heading') {
      const text = sanitizePlainText(nodeText(node), LINE_MAX)
      if (heading === null && text) heading = text
      else if (text && lines.length < MAX_LINES) lines.push(text)
      continue
    }

    if (type === 'paragraph') {
      const text = sanitizePlainText(nodeText(node), LINE_MAX)
      if (text && lines.length < MAX_LINES) lines.push(text)
      if (!imageSrc) imageSrc = findImageSrc(node, options.documentId)
      continue
    }

    if (LIST_TYPES.has(type) && !list) {
      const items = listItems(node)
      if (items.length > 0) list = items
      continue
    }

    if (!imageSrc) imageSrc = findImageSrc(node, options.documentId)
  }

  const preview: DocumentGridPreview = { heading, lines }
  if (list) preview.list = list
  if (imageSrc) preview.imageSrc = imageSrc
  return preview
}

export const extractDocumentGridPreview = (
  data: Buffer | Uint8Array | null | undefined,
  options: { documentId: string }
): DocumentGridPreview => {
  if (!data || data.byteLength === 0) return { ...EMPTY_DOCUMENT_GRID_PREVIEW }

  const ydoc = new Y.Doc()
  try {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
    Y.applyUpdate(ydoc, bytes)
    const json = TiptapTransformer.fromYdoc(ydoc, 'default')
    return previewFromPmJson(json, options)
  } catch {
    return { ...EMPTY_DOCUMENT_GRID_PREVIEW }
  } finally {
    ydoc.destroy()
  }
}

/** Sets `preview` only. Prisma `update` would stamp `@updatedAt` and rewrite Last modified. */
const persistDocumentGridPreview = async (
  prisma: PrismaClient,
  documentId: string,
  preview: DocumentGridPreview,
  options: { onlyIfNull: boolean }
): Promise<void> => {
  const payload = JSON.stringify(preview)
  if (options.onlyIfNull) {
    await prisma.$executeRaw`
      UPDATE "DocumentMetadata"
      SET preview = CAST(${payload} AS jsonb)
      WHERE "documentId" = ${documentId}
        AND preview IS NULL
    `
    return
  }

  await prisma.$executeRaw`
    UPDATE "DocumentMetadata"
    SET preview = CAST(${payload} AS jsonb)
    WHERE "documentId" = ${documentId}
  `
}

export const refreshDocumentGridPreview = async (
  prisma: PrismaClient,
  args: {
    documentId: string
    data: Buffer | Uint8Array | null | undefined
  }
): Promise<DocumentGridPreview> => {
  const preview = extractDocumentGridPreview(args.data, { documentId: args.documentId })
  await persistDocumentGridPreview(prisma, args.documentId, preview, { onlyIfNull: false })
  return preview
}

export const fillMissingDocumentPreviews = async (
  prisma: PrismaClient,
  documentIds: string[]
): Promise<Map<string, DocumentGridPreview>> => {
  const filled = new Map<string, DocumentGridPreview>()
  if (documentIds.length === 0) return filled

  let latest: { documentId: string; data: Buffer }[] = []
  try {
    latest = await prisma.$queryRaw<{ documentId: string; data: Buffer }[]>`
      SELECT DISTINCT ON ("documentId") "documentId", data
      FROM "Documents"
      WHERE "documentId" = ANY(${documentIds})
      ORDER BY "documentId", version DESC
    `
  } catch (err) {
    dbLogger.warn({ err }, 'Failed to load snapshots for document previews')
    for (const documentId of documentIds) filled.set(documentId, { ...EMPTY_DOCUMENT_GRID_PREVIEW })
    return filled
  }

  const dataMap = new Map(latest.map((row) => [row.documentId, row.data]))
  const extracted = documentIds.map((documentId) => ({
    documentId,
    preview: extractDocumentGridPreview(dataMap.get(documentId) ?? null, { documentId })
  }))

  await Promise.all(
    extracted.map(({ documentId, preview }) =>
      persistDocumentGridPreview(prisma, documentId, preview, { onlyIfNull: true }).catch((err) => {
        dbLogger.warn({ err, documentId }, 'Failed to persist document preview')
      })
    )
  )

  for (const { documentId, preview } of extracted) filled.set(documentId, preview)
  return filled
}
