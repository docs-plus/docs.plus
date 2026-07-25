import HTMLtoDOCX from '@turbodocx/html-to-docx'

import type { TiptapDocJson } from '../types'
import { renderDocumentHtml } from './documentHtml'

// XML 1.0 forbids control characters outright — not even a numeric entity is
// legal — and xmlbuilder2 throws on one, which turned a single pasted character
// into a permanent 500 on every DOCX export of that document.
// eslint-disable-next-line no-control-regex -- matching them is the whole point
const XML_CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g

// The converter interpolates `title` straight into `docProps/core.xml`, so an
// angle bracket in a document title throws an XML parse error inside xmlbuilder2.
// Dropping the brackets is the only fix that reads correctly in Word: its parser
// never decodes entities, so a pre-escaped title arrives double-encoded.
const toCorePropertyTitle = (title: string): string =>
  title.replace(/[<>]/g, '').replace(XML_CONTROL_CHARS, '')

// The converter emits the doctype declaration as a text node, so the rendered
// HTML would open every Word file with a blank paragraph. The `<meta charset>` is
// what carries the encoding, and it stays.
const DOCTYPE = /^\s*<!doctype[^>]*>/i

/**
 * `title` is written twice on purpose: into the HTML `<title>` and into the DOCX
 * core properties, which is what Word's File > Info pane and desktop search read.
 * The converter returns a Buffer only where `global.Buffer` exists — Bun and Node
 * both do, so the other two arms of its union are unreachable here.
 */
export const exportDocx = async (
  doc: TiptapDocJson,
  title: string,
  mediaBaseUrl: string | null
): Promise<Buffer> => {
  const html = renderDocumentHtml(doc, title, mediaBaseUrl)
    .replace(DOCTYPE, '')
    .replace(XML_CONTROL_CHARS, '')
  const output = await HTMLtoDOCX(html, null, { title: toCorePropertyTitle(title) })
  if (Buffer.isBuffer(output)) return output

  const bytes = output instanceof ArrayBuffer ? output : await output.arrayBuffer()
  return Buffer.from(bytes)
}
