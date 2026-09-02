import type { TiptapDocJson } from '../document-content/types'

export type { TiptapDocJson }

export type ExportFormat = 'docx' | 'md' | 'odt'
export type ImportFormat = 'docx' | 'md'

/** Extensions and declared MIME types lie, so both the import and export gates
 *  read the container's leading bytes instead. */
export const startsWith = (bytes: Uint8Array, magic: number[]): boolean =>
  magic.every((byte, index) => bytes[index] === byte)

export type ConversionWarningCode =
  | 'media-placeholder-dropped'
  | 'title-promoted-paragraph'
  | 'title-synthesized'
  | 'unsupported-element'

/** Lossy conversions are reported, never silent — the user has to know what changed. */
export interface ConversionWarning {
  code: ConversionWarningCode
  message: string
}

export interface ImportResult {
  content: TiptapDocJson
  title: string
  warnings: ConversionWarning[]
}

export type TitleHeadingBranch = 'already-heading' | 'promoted-paragraph' | 'synthesized'

export interface TitleHeadingResult {
  doc: TiptapDocJson
  branch: TitleHeadingBranch
}

/** Matches the pad's media upload cap (`DO_STORAGE_MAX_FILE_SIZE`, 10 MB). */
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024

// A zip bounds its compressed size, never its inflated one: 200 KiB of deflated
// zeroes reach 200 MiB, and mammoth's unzip has no cap of its own. Word files
// hold images, so the ratio has to be generous — it only has to refuse a bomb.
export const MAX_INFLATED_IMPORT_BYTES = 4 * MAX_IMPORT_BYTES

// `marked` parses in quadratic time (64 KiB ≈ 0.6s, 954 KiB ≈ 144s), so an
// oversized body is rejected as `too-large`. Never truncate to fit: a silently
// halved document is worse than a refused one.
export const MAX_MARKDOWN_CHARS = 64 * 1024

// Matches the pad's upload cap. Inert while the inlined budget below is smaller,
// because `Math.min` never picks this cap. This cap binds only if that budget is
// raised, and it is kept because inlining removes the converter's own `maxImageSize`.
export const MAX_EXPORT_IMAGE_BYTES = 10 * 1024 * 1024

// Counted in inlined characters, and charged per `<img>` rather than per URL,
// because the converter writes one media part per node. Ten nodes sharing one
// src put ten copies in the HTML string. Peak RSS runs many times this against
// a 512M `rest-api` cgroup — see CLAUDE.md §HTTP Modules for the residual.
export const MAX_EXPORT_INLINED_BYTES = 8 * 1024 * 1024

// Bytes alone do not bound peak memory. The same 8 MiB measured 143 MiB of RSS
// across 64 images and 185 MiB across 256, because each image is its own media
// part. This ceiling also bounds how many sockets a single export opens.
export const MAX_EXPORT_IMAGES = 128

/** Per image; matches the converter's own `downloadTimeout`. */
export const EXPORT_IMAGE_TIMEOUT_MS = 5_000

// Fetching is serial, so the worst case was per-image timeout x image count.
// Measured at 66s against Bun's 60s `idleTimeout`, which closes the socket while
// the handler runs on. Read before each fetch rather than during one, so the true
// ceiling is this plus one in-flight image: 35s.
export const EXPORT_IMAGE_TOTAL_TIMEOUT_MS = 30_000
