import type { TiptapDocJson } from '../document-content/types'

export type { TiptapDocJson }

export type ExportFormat = 'docx' | 'md' | 'odt'
export type ImportFormat = 'docx' | 'md'

/** Narrows the untyped JSON this module walks; shared by every domain stage. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

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
