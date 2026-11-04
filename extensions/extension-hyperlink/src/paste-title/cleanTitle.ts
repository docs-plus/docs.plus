import { find } from 'linkifyjs'

const MAX_GRAPHEMES = 120
const WHITESPACE_RUN_RE = /\s+/g
// C0 and C1 controls, plus the bidi embeddings, overrides, isolates and marks (U+061C included).
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f-\u009f\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g
// A title of only invisible characters, such as U+200B, would make an empty-looking link.
const VISIBLE_RE = /[\p{L}\p{N}\p{P}\p{S}]/u

/**
 * Returns the title to show as link text, or `null` to keep the URL.
 * `text` is the pasted URL as it stands in the document; `href` is the stored href.
 */
export function cleanTitle(raw: string, link: { text: string; href: string }): string | null {
  // Whitespace first: tab and newline are C0 controls, and they must become a space, not vanish.
  const title = raw
    .replace(WHITESPACE_RUN_RE, ' ')
    .replace(CONTROL_RE, '')
    .replace(WHITESPACE_RUN_RE, ' ')
    .trim()
  if (!VISIBLE_RE.test(title) || title === link.text || title === link.href) return null
  if (spoofsHost(title, link.href)) return null
  return truncate(title)
}

// A title that reads as another site's address would hide where the link goes.
function spoofsHost(title: string, href: string): boolean {
  const [match] = find(title, 'url')
  if (!match || match.value !== title) return false
  if (isOwnFileName(title, href)) return false
  return hostOf(match.href) !== hostOf(href)
}

// File types whose extension is also a top-level domain. Only these pass, so a page at
// `evil.example/paypal.com` titled `paypal.com` still keeps its URL.
const FILE_EXTENSION_TLDS = new Set(['ai', 'md', 'mov', 'pl', 'ps', 'py', 'rs', 'sh', 'so', 'zip'])

// `archive.zip` reads as a domain, but naming the link's own file hides nothing.
function isOwnFileName(title: string, href: string): boolean {
  const extension = title.slice(title.lastIndexOf('.') + 1).toLowerCase()
  return FILE_EXTENSION_TLDS.has(extension) && title === fileNameOf(href)
}

function fileNameOf(href: string): string | null {
  try {
    const last = new URL(href).pathname.split('/').filter(Boolean).pop()
    return last ? decodeURIComponent(last) : null
  } catch {
    return null
  }
}

function hostOf(href: string): string | null {
  try {
    return new URL(href).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

function truncate(title: string): string {
  const parts = graphemes(title)
  if (parts.length <= MAX_GRAPHEMES) return title
  return `${parts.slice(0, MAX_GRAPHEMES).join('').trimEnd()}…`
}

// The package targets ES2020 libs, which do not type `Intl.Segmenter` (ES2022).
type GraphemeSegmenter = { segment(text: string): Iterable<{ segment: string }> }
type SegmenterConstructor = new (
  locale: undefined,
  options: { granularity: 'grapheme' }
) => GraphemeSegmenter

let segmenter: GraphemeSegmenter | null | undefined

function graphemes(text: string): string[] {
  if (segmenter === undefined) {
    const Segmenter = (globalThis.Intl as { Segmenter?: SegmenterConstructor } | undefined)
      ?.Segmenter
    segmenter = Segmenter ? new Segmenter(undefined, { granularity: 'grapheme' }) : null
  }
  return segmenter ? Array.from(segmenter.segment(text), (s) => s.segment) : Array.from(text)
}
