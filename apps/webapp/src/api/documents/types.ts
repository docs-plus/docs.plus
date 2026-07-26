import type { JSONContent } from '@tiptap/core'

/** Mirrors the server's `document-conversion/types.ts` — the closed set it implements. */
export type ExportFormat = 'docx' | 'md' | 'odt'

export interface ConversionWarning {
  code: string
  message: string
}

export interface ImportedDocument {
  content: JSONContent
  title: string
  warnings: ConversionWarning[]
}
