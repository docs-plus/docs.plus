import { createHmac, timingSafeEqual } from 'crypto'

const CTRL_OR_BIDI_INLINE = (cp: number): boolean =>
  cp < 32 || cp === 127 || (cp >= 0x202a && cp <= 0x202e) || (cp >= 0x2066 && cp <= 0x2069)

const CTRL_OR_BIDI_MULTILINE = (cp: number): boolean =>
  (cp < 32 && cp !== 10 && cp !== 9) ||
  cp === 127 ||
  (cp >= 0x202a && cp <= 0x202e) ||
  (cp >= 0x2066 && cp <= 0x2069)

export function verifyGitHubSignature(
  rawBody: Uint8Array,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=') || !secret) return false
  const receivedHex = signatureHeader.slice(7).trim().toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(receivedHex)) return false

  const expected = createHmac('sha256', secret).update(rawBody).digest()
  const received = Buffer.from(receivedHex, 'hex')
  if (expected.length !== received.length) return false
  return timingSafeEqual(expected, received)
}

/** Strips control chars and bidi overrides while keeping Persian ZWNJ and emoji ZWJ intact. */
export function cleanText(input: string): string {
  let out = ''
  for (const ch of input) {
    const cp = ch.codePointAt(0) ?? 32
    out += CTRL_OR_BIDI_INLINE(cp) ? ' ' : ch
  }
  return out.replace(/\s+/g, ' ').trim().replace(/\]\(/g, '] (')
}

export function cleanMultilineText(input: string): string {
  let out = ''
  for (const ch of input.replace(/\r\n/g, '\n')) {
    const cp = ch.codePointAt(0) ?? 32
    out += CTRL_OR_BIDI_MULTILINE(cp) ? ' ' : ch
  }
  return out.replace(/\]\(/g, '] (')
}

export function sanitizeChip(label: string): string {
  const cleaned = cleanText(label).replace(/`/g, '')
  if (!cleaned) return ''
  return cleaned.length > 30 ? `${cleaned.slice(0, 29)}…` : cleaned
}

export function isSafeHttpsUrl(url: string | undefined | null): url is string {
  if (!url) return false
  try {
    const parsed = new URL(url.trim())
    return parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function stripHtmlAndExtractBanner(markdown: string): {
  text: string
  bannerUrl: string | null
} {
  let bannerUrl: string | null = null

  const pictureMatch = /<picture[\s\S]*?<\/picture>/i.exec(markdown)
  if (pictureMatch) {
    const block = pictureMatch[0]
    const darkSrc =
      /<source[^>]*prefers-color-scheme:\s*dark[^>]*srcset=["']([^"']+)["']/i.exec(block)?.[1] ??
      /<source[^>]*srcset=["']([^"']+)["']/i.exec(block)?.[1] ??
      /<img[^>]*src=["']([^"']+)["']/i.exec(block)?.[1]
    if (isSafeHttpsUrl(darkSrc)) bannerUrl = darkSrc.trim()
  }

  if (!bannerUrl) {
    const imgSrc = /<img[^>]*src=["']([^"']+)["']/i.exec(markdown)?.[1]
    if (isSafeHttpsUrl(imgSrc)) bannerUrl = imgSrc.trim()
  }

  // Protect fenced code blocks before stripping HTML tags from prose.
  const segments = markdown.replace(/\r\n/g, '\n').split(/(```[\s\S]*?```)/g)
  const cleanedSegments = segments.map((seg, idx) => {
    if (idx % 2 === 1) return seg
    let prose = seg
    let prev: string
    do {
      prev = prose
      prose = prose.replace(/<!--[\s\S]*?-->/g, '')
    } while (prose !== prev)
    do {
      prev = prose
      prose = prose.replace(/<picture[\s\S]*?<\/picture>/gi, '')
    } while (prose !== prev)
    prose = prose.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n')
    do {
      prev = prose
      prose = prose.replace(/<[^>]+>/g, '')
    } while (prose !== prev)

    // Strip control chars and bidi overrides without touching valid markdown links.
    let safe = ''
    for (const ch of prose) {
      const cp = ch.codePointAt(0) ?? 32
      safe += CTRL_OR_BIDI_MULTILINE(cp) ? ' ' : ch
    }
    prose = safe.replace(/\n{3,}/g, '\n\n')
    return prose
  })

  return {
    text: cleanedSegments.join('').trim(),
    bannerUrl
  }
}

function findSafeCutIndex(text: string, limit: number): number {
  if (text.length <= limit) return text.length
  const window = text.slice(0, limit)

  const paraBreak = window.lastIndexOf('\n\n')
  if (paraBreak >= Math.floor(limit * 0.55)) return paraBreak

  const lineBreak = window.lastIndexOf('\n')
  if (lineBreak >= Math.floor(limit * 0.55)) return lineBreak

  const wordBreak = window.lastIndexOf(' ')
  if (wordBreak >= Math.floor(limit * 0.45)) return wordBreak

  return limit
}

export function truncateMarkdownSafe(
  input: string,
  maxLen: number
): { text: string; truncated: boolean } {
  const normalized = input.trim()
  if (normalized.length <= maxLen) return { text: normalized, truncated: false }
  if (maxLen <= 1) return { text: '…'.slice(0, maxLen), truncated: true }

  // Reserve space for a possible closing code fence ("\n```") plus ellipsis.
  let cut = findSafeCutIndex(normalized, maxLen - 5)
  let slice = normalized.slice(0, cut).trimEnd()

  const fenceCount = (slice.match(/```/g) ?? []).length
  if (fenceCount % 2 === 1) {
    const closing = '\n```'
    if (slice.length + closing.length + 1 > maxLen) {
      cut = findSafeCutIndex(slice, maxLen - closing.length - 1)
      slice = slice.slice(0, cut).trimEnd()
    }
    const reopened = (slice.match(/```/g) ?? []).length
    return {
      text: reopened % 2 === 1 ? `${slice}${closing}…` : `${slice}…`,
      truncated: true
    }
  }

  return { text: `${slice}…`, truncated: true }
}

export function truncateTitle(input: string, maxLen = 100): string {
  const cleaned = cleanText(input)
  if (cleaned.length <= maxLen) return cleaned
  const cut = findSafeCutIndex(cleaned, maxLen - 1)
  return `${cleaned.slice(0, cut).trimEnd()}…`
}

export function extractCommentExcerpt(body: string | null | undefined, maxLen = 220): string {
  if (!body) return ''
  let withoutComments = body.replace(/\r\n/g, '\n')
  let prev: string
  do {
    prev = withoutComments
    withoutComments = withoutComments.replace(/<!--[\s\S]*?-->/g, '')
  } while (withoutComments !== prev)
  withoutComments = withoutComments
    .replace(/```[\s\S]*?```/g, '[code]')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
  do {
    prev = withoutComments
    withoutComments = withoutComments.replace(/<[^>]+>/g, '')
  } while (withoutComments !== prev)

  const lines = withoutComments
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('>'))

  if (lines.length === 0) return ''
  const joined = cleanText(lines.join(' '))
  if (!joined) return ''
  return truncateTitle(joined, maxLen)
}
