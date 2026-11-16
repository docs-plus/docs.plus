import type { Context } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import type { Logger } from 'pino'
import slugify from 'slugify'

import type { PrismaClient } from '../../../generated/prisma/client'
import { fail, ok } from '../../../http/envelope'
import { decideDocumentAccess } from '../../../lib/documentAccess'
import { acquireLargeDecode, LARGE_DECODE_BYTES } from '../../../lib/largeDecodeGate'
import { ydocToPmJson } from '../../../lib/nested-flat-migration'
import { isDocumentOwner } from '../../../lib/ownerAccess'
import { findHeadRow } from '../../document-content/infra/contentStore'
import { MAX_CONTENT_DEPTH, MAX_CONTENT_NODES } from '../../document-content/types'
import { exportDocx } from '../domain/docxExport'
import { importDocx, TooManyImagesError } from '../domain/docxImport'
import { titleHeadingText } from '../domain/ensureTitleHeading'
import { checkImportSize, type ImportSizeRefusal } from '../domain/importGuards'
import { exportMarkdown } from '../domain/markdownExport'
import { importMarkdown } from '../domain/markdownImport'
import { exportOdt } from '../domain/odtExport'
import { ENTRY_COUNT_MISMATCH, zipInflateSize } from '../domain/zipInflateSize'
import { createImageUpload } from '../infra/imageUpload'
import type { ExportFormat, ImportFormat, TiptapDocJson } from '../types'
import {
  IMPORT_MULTIPART_SLACK_BYTES,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_IMAGES,
  MAX_IMPORT_YJS_BYTES,
  MAX_INFLATED_IMPORT_BYTES,
  MAX_MARKDOWN_CHARS,
  MAX_OWNER_IMPORT_BYTES,
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

/** Service-role passes. A user answers the same rule as the WS gate and the
 *  slug read. Write adds the admin lock, refused before any conversion CPU. */
const deny = (c: Context, meta: ConversionMeta, want: 'read' | 'write'): Response | null => {
  if (c.get('serviceRole')) return null

  const caller = { userId: c.get('userId'), isAnonymous: c.get('user')?.is_anonymous }
  switch (decideDocumentAccess(meta, caller, want)) {
    case 'allow':
      return null
    case 'not-found':
      return fail(c, 404, 'NOT_FOUND', 'Document not found')
    case 'sign-in-required':
      return fail(c, 401, 'UNAUTHORIZED', 'Sign in to access this document')
    case 'denied':
      return fail(c, 403, 'FORBIDDEN', 'This document is private')
    case 'read-only':
      return fail(c, 403, 'FORBIDDEN', 'This document is read-only')
  }
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
  mediaBaseUrl: string | null,
  mediaCookie: string | null
): Promise<Uint8Array> => {
  switch (format) {
    case 'docx':
      return exportDocx(doc, title, mediaBaseUrl, mediaCookie)
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
  mediaCookieFor: (uid: string) => string | null
}

export const createGetExportHandler =
  (deps: ExportControllerDeps) =>
  async (c: Context): Promise<Response> => {
    const documentId = c.req.param('documentId') as string
    const { format } = c.req.valid('query' as never) as { format: ExportFormat }

    const meta = await findConversionMeta(deps.prisma, documentId)
    if (!meta || meta.deletedAt) return fail(c, 404, 'NOT_FOUND', 'Document not found')
    const denied = deny(c, meta, 'read')
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
    // The gate above already allowed this read. The media route still needs the
    // owner's cookie, or a Private document exports with no images.
    const mediaCookie = meta.isPrivate && meta.ownerId ? deps.mediaCookieFor(meta.ownerId) : null
    let bytes: Uint8Array
    try {
      bytes = await renderExport(format, doc, title, deps.mediaPublicBaseUrl, mediaCookie)
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

const uploadCap = (isOwner: boolean): number =>
  isOwner ? MAX_OWNER_IMPORT_BYTES : MAX_IMPORT_BYTES

const uploadTooLarge = (c: Context, isOwner: boolean): Response =>
  fail(
    c,
    413,
    'PAYLOAD_TOO_LARGE',
    isOwner
      ? `The upload exceeds the owner's ${MAX_OWNER_IMPORT_BYTES}-byte limit`
      : `The upload exceeds the ${MAX_IMPORT_BYTES}-byte limit; only the document owner may import up to ${MAX_OWNER_IMPORT_BYTES} bytes`
  )

// Built per request, after the owner is known, so nobody buffers past their own cap.
// It reads Content-Length when there is one, and counts a chunked body as it arrives.
const refuseOverCap = async (c: Context, isOwner: boolean): Promise<Response | null> =>
  (await bodyLimit({
    maxSize: uploadCap(isOwner) + IMPORT_MULTIPART_SLACK_BYTES,
    onError: (limited) => uploadTooLarge(limited, isOwner)
  })(c, async () => {})) || null

const SIZE_REFUSALS: Record<ImportSizeRefusal, string> = {
  TOO_MANY_NODES: `The import holds more than ${MAX_CONTENT_NODES} nodes, the most one document may hold`,
  TOO_DEEP: `The import nests deeper than ${MAX_CONTENT_DEPTH} levels, the most one document may hold`,
  TOO_LARGE_TO_OPEN: `The import encodes past ${MAX_IMPORT_YJS_BYTES} bytes, so a browser could not load the document`
}

// Matches the large-decode gate's own wait, so a retry lands after one parse.
const IMPORT_BUSY_RETRY_SECONDS = '10'

export interface ImportControllerDeps {
  prisma: PrismaClient
  logger: Logger
  mediaPublicBaseUrl: string | null
}

/**
 * No database write and no content mutation. The webapp applies the result in
 * the browser, through its own editor. Admission still costs write access,
 * because a locked document's readers can never apply the result.
 */
export const createPostImportHandler =
  (deps: ImportControllerDeps) =>
  async (c: Context): Promise<Response> => {
    const documentId = c.req.param('documentId') as string

    const meta = await findConversionMeta(deps.prisma, documentId)
    if (!meta || meta.deletedAt) return fail(c, 404, 'NOT_FOUND', 'Document not found')
    const denied = deny(c, meta, 'write')
    if (denied) return denied

    // The owner flag comes from the stored `ownerId`, never from the client.
    const isOwner = isDocumentOwner(meta, c.get('userId'))
    const overCap = await refuseOverCap(c, isOwner)
    if (overCap) return overCap

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
    if (upload.size > uploadCap(isOwner)) return uploadTooLarge(c, isOwner)

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

    // A 306 KiB upload can unpack to 40 MiB, so every import takes the slot. No
    // queue: a second import answers at once instead of stacking loop blocks.
    const release = await acquireLargeDecode(Math.max(LARGE_DECODE_BYTES, buffer.length), 0)
    if (!release) {
      deps.logger.warn({ code: 'IMPORT_BUSY', uploadBytes: buffer.length }, 'Import refused')
      c.header('Retry-After', IMPORT_BUSY_RETRY_SECONDS)
      return fail(
        c,
        503,
        'IMPORT_BUSY',
        'Another import is running on this server. Try again in a few seconds.'
      )
    }
    // The body is already read, so a client abort cannot skip this `finally`.
    try {
      return await convertUpload(c, deps, { documentId, slug: meta.slug, buffer, kind })
    } finally {
      release()
    }
  }

interface ConvertUploadInput {
  documentId: string
  slug: string
  buffer: Buffer
  kind: ImportFormat
}

const convertUpload = async (
  c: Context,
  deps: ImportControllerDeps,
  { documentId, slug, buffer, kind }: ConvertUploadInput
): Promise<Response> => {
  // mammoth's unzip is unbounded, so the upload cap alone lets a few hundred
  // compressed KiB inflate the process to death.
  if (kind === 'docx') {
    const unpacked = zipInflateSize(buffer, MAX_INFLATED_IMPORT_BYTES)
    if (unpacked === ENTRY_COUNT_MISMATCH) {
      deps.logger.warn(
        { code: 'ZIP_ENTRY_COUNT_MISMATCH', uploadBytes: buffer.length },
        'Import refused'
      )
      return fail(
        c,
        422,
        'UNPROCESSABLE_ENTITY',
        'The upload is not a valid zip: its directory does not match its entry count'
      )
    }
    if ((unpacked ?? 0) > MAX_INFLATED_IMPORT_BYTES) {
      return fail(
        c,
        413,
        'PAYLOAD_TOO_LARGE',
        `The upload unpacks to more than the ${MAX_INFLATED_IMPORT_BYTES}-byte limit`
      )
    }
  }

  let markdown: string | null = null
  if (kind === 'md') {
    markdown = decodeUtf8(buffer)
    if (markdown === null) {
      return fail(c, 422, 'UNPROCESSABLE_ENTITY', 'The upload is neither a .docx file nor text')
    }
    // A reject, never a truncate, for owner and non-owner alike. Hostile Markdown
    // past this blocks the event loop for minutes (bench-import.ts).
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
            fallbackTitle: slug,
            uploadImage: createImageUpload({ documentId, publicBaseUrl: deps.mediaPublicBaseUrl })
          })
        : importMarkdown(markdown, slug)
    // Refused here, the replace never reaches the room, so nothing is saved.
    const refusal = checkImportSize(result.content)
    if (refusal) return fail(c, 413, refusal, SIZE_REFUSALS[refusal])
    return ok(c, result)
  } catch (error) {
    if (error instanceof TooManyImagesError) {
      deps.logger.warn(
        { code: 'TOO_MANY_IMAGES', uploadBytes: buffer.length, images: error.images },
        'Import refused'
      )
      return fail(
        c,
        413,
        'TOO_MANY_IMAGES',
        `The upload holds more than ${MAX_IMPORT_IMAGES} images, the most one import may hold`
      )
    }
    // A truncated or re-zipped file passes the magic-byte sniff and only fails
    // here, so this stays the caller's problem — retrying will not fix it.
    deps.logger.error({ err: error, documentId, format: kind }, 'Document import failed')
    return fail(c, 422, 'UNPROCESSABLE_ENTITY', IMPORT_FAILED[kind])
  }
}
