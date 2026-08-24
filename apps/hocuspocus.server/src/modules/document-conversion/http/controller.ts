import type { PrismaClient } from '@prisma/client'
import type { Context } from 'hono'
import type { Logger } from 'pino'
import slugify from 'slugify'

import { ydocToPmJson } from '../../../lib/nested-flat-migration'
import { resolvePrivateAccess } from '../../../lib/privateAccess'
import { fail, ok } from '../../document-content/http/controller'
import { findHeadRow } from '../../document-content/infra/contentStore'
import { exportDocx } from '../domain/docxExport'
import { importDocx } from '../domain/docxImport'
import { titleHeadingText } from '../domain/ensureTitleHeading'
import { exportMarkdown } from '../domain/markdownExport'
import { importMarkdown } from '../domain/markdownImport'
import { exportOdt } from '../domain/odtExport'
import { zipInflateSize } from '../domain/zipInflateSize'
import { createImageUpload } from '../infra/imageUpload'
import type { ExportFormat, ImportFormat, TiptapDocJson } from '../types'
import {
  MAX_IMPORT_BYTES,
  MAX_INFLATED_IMPORT_BYTES,
  MAX_MARKDOWN_CHARS,
  startsWith
} from '../types'

interface ConversionMeta {
  slug: string
  ownerId: string | null
  deletedAt: Date | null
  isPrivate: boolean
  readOnly: boolean
}

// The shared `findDocumentMeta` projection carries no access columns, so the gate
// fields ride this one lookup instead of a second round trip per request.
const findConversionMeta = (
  prisma: PrismaClient,
  documentId: string
): Promise<ConversionMeta | null> =>
  prisma.documentMetadata.findUnique({
    where: { documentId },
    select: { slug: true, ownerId: true, deletedAt: true, isPrivate: true, readOnly: true }
  })

/** Service-role passes. A user answers the same predicate as the WS gate and
 *  the slug read, so one privacy rule covers every surface. */
const denyRead = (c: Context, meta: ConversionMeta): Response | null => {
  if (c.get('serviceRole')) return null

  const access = resolvePrivateAccess({
    isPrivate: meta.isPrivate,
    ownerId: meta.ownerId,
    userId: c.get('userId'),
    isAnonymous: c.get('user')?.is_anonymous
  })
  if (access === 'sign-in-required')
    return fail(c, 401, 'UNAUTHORIZED', 'Sign in to access this document')
  if (access === 'denied') return fail(c, 403, 'FORBIDDEN', 'This document is private')
  return null
}

/** Read access plus the admin lock. Refuse a locked document's non-owners
 *  before spending the CPU on a conversion. */
const denyWrite = (c: Context, meta: ConversionMeta): Response | null => {
  const denied = denyRead(c, meta)
  if (denied) return denied
  if (c.get('serviceRole')) return null
  if (meta.readOnly && c.get('userId') !== meta.ownerId)
    return fail(c, 403, 'FORBIDDEN', 'This document is read-only')
  return null
}

const EXPORT_MEDIA_TYPES: Record<ExportFormat, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  md: 'text/markdown; charset=utf-8',
  odt: 'application/vnd.oasis.opendocument.text'
}

// Strict slugify emits `[a-z0-9-]` or nothing at all. An all-emoji title would
// otherwise degenerate to `filename=".docx"`, and only slugified text is safe to
// interpolate into the header.
const exportFilename = (
  title: string,
  slug: string,
  documentId: string,
  format: ExportFormat
): string => {
  const strict = (value: string): string => slugify(value, { lower: true, strict: true })
  return `${strict(title) || strict(slug) || documentId}.${format}`
}

const renderExport = async (
  format: ExportFormat,
  doc: TiptapDocJson,
  title: string,
  mediaBaseUrl: string | null
): Promise<Uint8Array> => {
  switch (format) {
    case 'docx':
      return exportDocx(doc, title, mediaBaseUrl)
    case 'md':
      return Buffer.from(exportMarkdown(doc), 'utf8')
    case 'odt':
      return exportOdt(doc, title)
    default: {
      const exhaustive: never = format
      return exhaustive
    }
  }
}

export interface ExportControllerDeps {
  prisma: PrismaClient
  logger: Logger
  /** Doubles as the DOCX image allowlist — see `renderDocumentHtml`. */
  mediaPublicBaseUrl: string | null
}

export const createGetExportHandler =
  (deps: ExportControllerDeps) =>
  async (c: Context): Promise<Response> => {
    const documentId = c.req.param('documentId') as string
    const { format } = c.req.valid('query' as never) as { format: ExportFormat }

    const meta = await findConversionMeta(deps.prisma, documentId)
    if (!meta || meta.deletedAt) return fail(c, 404, 'NOT_FOUND', 'Document not found')
    const denied = denyRead(c, meta)
    if (denied) return denied

    const head = await findHeadRow(deps.prisma, documentId)
    // Metadata without a snapshot is a document nobody has persisted yet, which
    // exports as an empty file rather than a 404 — same rule as GET /content.
    let doc: TiptapDocJson = { type: 'doc', content: [] }
    if (head) {
      const decoded = ydocToPmJson(head.data)
      if (!decoded.ok) {
        deps.logger.error(
          { err: decoded.error, documentId, version: head.version },
          'Snapshot decode failed'
        )
        return fail(c, 500, 'INTERNAL_SERVER_ERROR', 'Stored document content could not be decoded')
      }
      doc = decoded.json as unknown as TiptapDocJson
    }

    const title = titleHeadingText(doc) || meta.slug
    let bytes: Uint8Array
    try {
      bytes = await renderExport(format, doc, title, deps.mediaPublicBaseUrl)
    } catch (error) {
      deps.logger.error({ err: error, documentId, format }, 'Document export failed')
      return fail(
        c,
        500,
        'INTERNAL_SERVER_ERROR',
        `The document could not be converted to ${format}`
      )
    }

    // Only the 200 leaves the house envelope — a binary body cannot carry it.
    return new Response(bytes, {
      headers: {
        'Content-Type': EXPORT_MEDIA_TYPES[format],
        'Content-Disposition': `attachment; filename="${exportFilename(title, meta.slug, documentId, format)}"`
      }
    })
  }

const UPLOAD_FIELD = 'documentFile'

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]
const OLE2_MAGIC = [0xd0, 0xcf, 0x11, 0xe0]

type UploadKind = ImportFormat | 'legacy-doc'

// Extensions and declared MIME types both lie often enough that the container is
// the only honest signal. OOXML is a zip, and OLE2 is a real `.doc`. Markdown has
// no magic, so it is the residue — the strict decode below is its real gate.
const sniffUpload = (bytes: Uint8Array): UploadKind => {
  if (startsWith(bytes, ZIP_MAGIC)) return 'docx'
  if (startsWith(bytes, OLE2_MAGIC)) return 'legacy-doc'
  return 'md'
}

// `fatal` is what rejects a binary upload that fell through the sniff. The default
// BOM handling strips the U+FEFF a Windows editor writes. A kept U+FEFF hides the
// opening `#`, and the whole file imports as one promoted paragraph.
const decodeUtf8 = (bytes: Uint8Array): string | null => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}

const IMPORT_FAILED: Record<ImportFormat, string> = {
  docx: 'The upload could not be read as a Word document',
  md: 'The upload could not be read as Markdown'
}

export interface ImportControllerDeps {
  prisma: PrismaClient
  logger: Logger
  mediaPublicBaseUrl: string | null
}

/**
 * No database write and no content mutation — the caller applies the result
 * through `PATCH /content`. Admission still costs write access, because a
 * locked document's readers can never apply the result.
 */
export const createPostImportHandler =
  (deps: ImportControllerDeps) =>
  async (c: Context): Promise<Response> => {
    const documentId = c.req.param('documentId') as string

    const meta = await findConversionMeta(deps.prisma, documentId)
    if (!meta || meta.deletedAt) return fail(c, 404, 'NOT_FOUND', 'Document not found')
    const denied = denyWrite(c, meta)
    if (denied) return denied

    let form: FormData
    try {
      form = await c.req.formData()
    } catch {
      return fail(c, 400, 'VALIDATION_ERROR', 'Expected a multipart/form-data body')
    }

    const upload = form.get(UPLOAD_FIELD)
    if (!(upload instanceof File)) {
      return fail(c, 400, 'VALIDATION_ERROR', `Expected a file in the \`${UPLOAD_FIELD}\` field`)
    }
    if (upload.size > MAX_IMPORT_BYTES) {
      return fail(
        c,
        413,
        'PAYLOAD_TOO_LARGE',
        `The upload exceeds the ${MAX_IMPORT_BYTES}-byte limit`
      )
    }

    const buffer = Buffer.from(await upload.arrayBuffer())
    const kind = sniffUpload(buffer)
    if (kind === 'legacy-doc') {
      return fail(
        c,
        415,
        'UNSUPPORTED_MEDIA_TYPE',
        'legacy .doc is not supported — re-save as .docx'
      )
    }
    // mammoth's unzip is unbounded, so the upload cap alone lets a few hundred
    // compressed KiB inflate the process to death.
    if (
      kind === 'docx' &&
      (zipInflateSize(buffer, MAX_INFLATED_IMPORT_BYTES) ?? 0) > MAX_INFLATED_IMPORT_BYTES
    ) {
      return fail(
        c,
        413,
        'PAYLOAD_TOO_LARGE',
        `The upload unpacks to more than the ${MAX_INFLATED_IMPORT_BYTES}-byte limit`
      )
    }

    let markdown: string | null = null
    if (kind === 'md') {
      markdown = decodeUtf8(buffer)
      if (markdown === null) {
        return fail(c, 422, 'UNPROCESSABLE_ENTITY', 'The upload is neither a .docx file nor text')
      }
      // A reject, never a truncate: `marked` is quadratic (954 KiB blocks the
      // event loop for ~144s), and half a document is worse than a refused one.
      if (markdown.length > MAX_MARKDOWN_CHARS) {
        return fail(
          c,
          413,
          'PAYLOAD_TOO_LARGE',
          `Markdown is capped at ${MAX_MARKDOWN_CHARS} characters — convert the document to .docx and import that instead`
        )
      }
    }

    try {
      const result =
        markdown === null
          ? await importDocx(buffer, {
              fallbackTitle: meta.slug,
              uploadImage: createImageUpload({ documentId, publicBaseUrl: deps.mediaPublicBaseUrl })
            })
          : importMarkdown(markdown, meta.slug)
      return ok(c, result)
    } catch (error) {
      // A truncated or re-zipped file passes the magic-byte sniff and only fails
      // here, so this stays the caller's problem — retrying will not fix it.
      deps.logger.error({ err: error, documentId, format: kind }, 'Document import failed')
      return fail(c, 422, 'UNPROCESSABLE_ENTITY', IMPORT_FAILED[kind])
    }
  }
