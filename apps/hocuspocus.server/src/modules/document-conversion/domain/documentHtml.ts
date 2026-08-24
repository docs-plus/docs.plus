import { DOMParser, DOMSerializer, Node as PMNode } from '@tiptap/pm/model'
import { parseHTML } from 'linkedom'

import type { TiptapDocJson } from '../types'
import { getParseSchema, getRenderSchema } from './conversionSchema'
import { inlineExportImages } from './inlineExportImages'
import { toPortableJson } from './portableJson'

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;'
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"]/g, (char) => HTML_ESCAPES[char] ?? char)

/** linkedom ships no element types and this app has no DOM lib, so it is named here. */
export type ForeignImage = {
  getAttribute: (name: string) => string | null
  setAttribute: (name: string, value: string) => void
  remove: () => void
}

const originOf = (value: string): string | null => {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

/**
 * `charset` is load-bearing: the converter reads the declared encoding and
 * mangles non-ASCII text without it.
 */
export const renderDocumentHtml = async (
  doc: TiptapDocJson,
  title: string,
  mediaBaseUrl: string | null
): Promise<string> => {
  const schema = getRenderSchema()
  const node = PMNode.fromJSON(schema, toPortableJson(doc))
  // A fresh document per call: linkedom documents are stateful, so a shared one
  // interleaves concurrent renders.
  const { document } = parseHTML('<!doctype html><html><body></body></html>')
  const body = document.createElement('div')
  DOMSerializer.fromSchema(schema).serializeFragment(node.content, { document }, body)

  // The converter downloads every remote `<img src>` it is handed, and that src
  // is ordinary pad content. Any editor could therefore aim a service-role export
  // at a metadata endpoint. Only an allowlist holds: the library owns the socket
  // and follows redirects itself, past anything a denylist here could refuse.
  const allowed = mediaBaseUrl === null ? null : originOf(mediaBaseUrl)
  const permitted: ForeignImage[] = []
  for (const image of body.querySelectorAll('img') as ForeignImage[]) {
    if (allowed !== null && originOf(image.getAttribute('src') ?? '') === allowed) {
      permitted.push(image)
      continue
    }
    image.remove()
  }
  // Origin first: this fetches whatever it is handed.
  await inlineExportImages(permitted)

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body>${body.innerHTML}</body></html>`
}

// linkedom is not a spec tree builder. A bare fragment — what mammoth emits —
// parses with no `<html>`. `document.body` then reads *empty* instead of throwing.
// That silent empty would import every Word file as a blank page.
const FULL_DOCUMENT = /^\s*(?:<!doctype[^>]*>\s*)?<html[\s>]/i

/** Parses against the link-free variant, so `<a href>` lands on `hyperlink`. */
export const parseDocumentHtml = (html: string): TiptapDocJson => {
  const source = FULL_DOCUMENT.test(html)
    ? html
    : `<!doctype html><html><body>${html}</body></html>`
  const { document } = parseHTML(source)
  const parsed = DOMParser.fromSchema(getParseSchema()).parse(document.body)
  return parsed.toJSON() as TiptapDocJson
}
