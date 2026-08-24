import { isImageUrl } from '@docs.plus/extension-hypermultimedia'
import mammoth from 'mammoth'

import type { ConversionWarning, ImportResult } from '../types'
import { parseDocumentHtml } from './documentHtml'
import { ensureTitleHeading, titleHeadingText, titleHeadingWarning } from './ensureTitleHeading'

export interface ImportDocxOptions {
  fallbackTitle: string
  /** Injected so the domain never learns about object storage; must not return a `data:` URI. */
  uploadImage: (data: Buffer, contentType: string) => Promise<string>
}

// mammoth's default map stops at Heading1-6 and Strong, so Word's own Title
// style arrives as a plain paragraph and every import opens without an h1. Both
// syntaxes are listed because `p.X` matches the style id and `[style-name]` the
// display name, and a document carries whichever its authoring tool wrote.
const DOCX_STYLE_MAP = [
  "p[style-name='Title'] => h1:fresh",
  'p.Title => h1:fresh',
  "p[style-name='Subtitle'] => p:fresh",
  'p.Subtitle => p:fresh',
  "p[style-name='Quote'] => blockquote:fresh",
  "p[style-name='Intense Quote'] => blockquote:fresh",
  'p.Quote => blockquote:fresh',
  'u => u',
  'strike => s'
]

// `error` has exactly one producer in mammoth: the image converter's recovery
// path. That path drops the element and records the throw, so an upload failure
// costs one image and never the document.
const toWarning = (message: { type: string; message: string }): ConversionWarning => ({
  code: message.type === 'error' ? 'media-placeholder-dropped' : 'unsupported-element',
  message: message.message
})

/**
 * Nothing here touches the document: the caller owns persistence and the
 * read-only lock stays with `PATCH /content`. Embedded images are the one
 * side effect — `uploadImage` rehosts them to storage.
 */
export const importDocx = async (
  buffer: Buffer,
  { fallbackTitle, uploadImage }: ImportDocxOptions
): Promise<ImportResult> => {
  // mammoth dedupes messages by exact text, so the position is what stops ten
  // images failing the same way from being reported as one lost image.
  let position = 0
  const convertImage = mammoth.images.imgElement(async (image) => {
    const index = ++position
    let src: string
    try {
      src = await uploadImage(await image.readAsBuffer(), image.contentType)
    } catch (err) {
      // mammoth reports the throw verbatim by `.message`, so a bare rejection
      // would surface as `undefined` and name neither the cause nor the image.
      const reason = err instanceof Error ? err.message : String(err)
      throw new Error(`Image ${index} (${image.contentType}) could not be uploaded: ${reason}`)
    }
    // The editor's image node only parses a URL whose path ends in an image
    // extension. An extension-less upload URL therefore leaves an empty paragraph
    // and no message, which is the exact silent drop this pipeline exists to prevent.
    if (!isImageUrl(src)) {
      throw new Error(`Image ${index} was dropped: ${src} is not a readable image URL.`)
    }
    return { src }
  })

  const { value: html, messages } = await mammoth.convertToHtml(
    { buffer },
    { styleMap: DOCX_STYLE_MAP, convertImage }
  )

  const { doc, branch } = ensureTitleHeading(parseDocumentHtml(html), fallbackTitle)
  const title = titleHeadingText(doc) || fallbackTitle.trim()
  const warnings = messages.map(toWarning)
  const titled = titleHeadingWarning(branch, title)
  if (titled) warnings.push(titled)

  return { content: doc, title, warnings }
}
