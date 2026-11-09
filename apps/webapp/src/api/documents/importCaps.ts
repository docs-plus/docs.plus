// Copies the backend caps: MAX_OWNER_IMPORT_BYTES, MAX_IMPORT_BYTES, MAX_MARKDOWN_CHARS and
// MAX_IMPORT_YJS_BYTES (document-conversion), MAX_CONTENT_NODES and MAX_CONTENT_DEPTH
// (document-content). The server decides who owns the document; these only pick the copy.
const MB = 1024 * 1024
export const OWNER_WORD_IMPORT_MB = 40
export const WORD_IMPORT_MB = 10
export const MARKDOWN_IMPORT_CHARS = 64 * 1024
export const IMPORT_CONTENT_MB = 12
export const IMPORT_MAX_NODES = 50_000
export const IMPORT_MAX_DEPTH = 100

export const WORD_DOCUMENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/** Pinned locale, so the server render and the browser print the same digits. */
export const formatCount = (count: number): string => count.toLocaleString('en-US')

const wordImportMb = (isOwner: boolean) => (isOwner ? OWNER_WORD_IMPORT_MB : WORD_IMPORT_MB)

const markdownCap = `${formatCount(MARKDOWN_IMPORT_CHARS)} characters`

export const importCapsHint = (isOwner: boolean): string =>
  `Word files up to ${wordImportMb(isOwner)} MB. Markdown up to ${markdownCap}.`

const wordTooBig = (isOwner: boolean): string =>
  isOwner
    ? `That Word file is too big. You can import up to ${OWNER_WORD_IMPORT_MB} MB into a document you own.`
    : `That Word file is too big. You can import up to ${WORD_IMPORT_MB} MB. The document owner can import up to ${OWNER_WORD_IMPORT_MB} MB.`

const MARKDOWN_TOO_BIG = `That Markdown file is too big. Markdown is capped at ${markdownCap} for everyone. Save it as a Word file (.docx) and import that.`

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]

// A share with no name arrives as "Shared file", so the type and the zip bytes count too.
const isWordFile = async (file: File): Promise<boolean> => {
  if (/\.docx$/i.test(file.name) || file.type === WORD_DOCUMENT_TYPE) return true
  const head = new Uint8Array(await file.slice(0, ZIP_MAGIC.length).arrayBuffer())
  return ZIP_MAGIC.every((byte, index) => head[index] === byte)
}

/** Null when the file fits this person's caps. The server still reads the bytes. */
export const importTooBigMessage = async (file: File, isOwner: boolean): Promise<string | null> => {
  if (await isWordFile(file))
    return file.size > wordImportMb(isOwner) * MB ? wordTooBig(isOwner) : null
  if (file.size <= MARKDOWN_IMPORT_CHARS) return null
  return (await file.text()).length > MARKDOWN_IMPORT_CHARS ? MARKDOWN_TOO_BIG : null
}
