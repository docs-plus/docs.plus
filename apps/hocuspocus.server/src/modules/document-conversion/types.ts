import { MAX_WS_MESSAGE_BYTES, type TiptapDocJson } from '../document-content/types'

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
  | 'tracked-changes-accepted'
  | 'unsupported-element'

/** A loss the server can detect. An empty list does not prove nothing was lost; see API.md. */
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

/** Upload cap for a caller who may replace the document but does not own it.
 *  Matches the pad's media upload cap (`DO_STORAGE_MAX_FILE_SIZE`, 10 MB). */
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024

/** Upload cap for the document owner (maintainer ruling on #722, 2026-11-09). */
export const MAX_OWNER_IMPORT_BYTES = 40 * 1024 * 1024

/** Multipart boundary and header overhead, so an upload exactly at a cap is not refused. */
export const IMPORT_MULTIPART_SLACK_BYTES = 1024 * 1024

// A zip bounds its compressed size, never its inflated one: 200 KiB of deflated
// zeroes reach 200 MiB, and mammoth's unzip has no cap of its own. The owner gets
// no more. The Word parts cap below binds first on the text mammoth parses.
export const MAX_INFLATED_IMPORT_BYTES = 4 * MAX_IMPORT_BYTES

// Summed over every `word/*.xml` part, because parts add up: in a 512M container 3 MiB
// split into body and footnotes added 175 MiB of RSS, and 2.5 MiB at most 142 MiB, under
// the 172 MiB headroom. The tag limit below bounds node-dense text (#577, 2026-11-17).
export const MAX_IMPORT_WORD_PARTS_BYTES = 2.5 * 1024 * 1024

// `<w:p` and `<w:r` start tags, summed over the same parts. In a 512M container every
// shape at 14,500 tags added at most 166 MiB (n = 10), and at 15,000 one run of 15 added
// 178 MiB. The public corpus holds at most 10,000 (#577, 2026-11-17).
export const MAX_IMPORT_WORD_TAGS = 14_500

// A reject, never a truncate: a silently halved document is worse than a refused
// one. Applies to every caller. Bigger hostile Markdown blocks REST for minutes
// or passes 1 GiB of memory (scripts/bench-import.ts, #722).
export const MAX_MARKDOWN_CHARS = 64 * 1024

// A browser applies a replace as one Yjs update, and a larger saved state cannot
// load. The 4 MiB left under the socket cap covers the replaced document's delete
// set and the browser's own encoding.
export const MAX_IMPORT_YJS_BYTES = MAX_WS_MESSAGE_BYTES - 4 * 1024 * 1024

// `encodeContent` validates content expressions, not attribute values, so a stored
// `colspan` is unbounded. Writer tops out at 64 columns and Word at 63, so no span
// past this is representable anyway. Unclamped, it re-allocates gigabytes.
export const MAX_TABLE_SPAN = 64

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

// Counted per `convertImage` call, after the parse, so it bounds the uploads of one
// import and not parse memory. The public corpus holds at most 18 images. 512 is
// the 2026-11-16 ruling on #577, and it differs from `MAX_EXPORT_IMAGES` on purpose.
export const MAX_IMPORT_IMAGES = 512

/** Per image; matches the converter's own `downloadTimeout`. */
export const EXPORT_IMAGE_TIMEOUT_MS = 5_000

// Fetching is serial, so the worst case was per-image timeout x image count.
// Measured at 66s against Bun's 60s `idleTimeout`, which closes the socket while
// the handler runs on. Read before each fetch rather than during one, so the true
// ceiling is this plus one in-flight image: 35s.
export const EXPORT_IMAGE_TOTAL_TIMEOUT_MS = 30_000
