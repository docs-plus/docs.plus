import * as cheerio from 'cheerio'
import type { NextApiRequest, NextApiResponse } from 'next'
import ogs from 'open-graph-scraper'

// --- Response types ---

interface MetadataResponse {
  title: string
  description?: string
  image?: string
  icon?: string
  favicon?: string
  themeColor?: string
  success: true
}

interface ErrorResponse {
  success: false
  message: string
}

type ApiResponse = MetadataResponse | ErrorResponse

// --- Rate limiting (in-memory) ---
// NOTE: In serverless environments (Vercel), this Map resets on cold starts.
// Effective within a single warm instance; for production-grade limiting,
// swap to Redis or Vercel's Edge Config. Kept as a defense-in-depth layer.

const requestCounts = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 50 // requests per window
const RATE_WINDOW = 60_000 // 1 minute

const checkRateLimit = (ip: string): boolean => {
  const now = Date.now()
  const entry = requestCounts.get(ip)

  if (!entry || now > entry.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_WINDOW })
    return true
  }

  if (entry.count >= RATE_LIMIT) return false

  entry.count++
  return true
}

// Periodic cleanup to prevent memory leaks (runs every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60_000
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of requestCounts) {
    if (now > entry.resetTime) requestCounts.delete(ip)
  }
}, CLEANUP_INTERVAL)

// --- URL validation (SSRF prevention) ---

const isValidUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url)

    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) return false

    const hostname = parsed.hostname

    // Block localhost, loopback, and private IP ranges
    if (
      hostname === 'localhost' ||
      hostname === '[::1]' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      hostname.startsWith('169.254.') || // link-local
      hostname.startsWith('0.') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      return false
    }

    return true
  } catch {
    return false
  }
}

// --- Fetch with timeout + abort ---

const FETCH_TIMEOUT_MS = 10_000
const MAX_BODY_SIZE = 5 * 1024 * 1024 // 5 MB max HTML

const fetchWithTimeout = async (url: string): Promise<string> => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        // Identify as a bot/scraper — many sites serve different HTML to bots
        'User-Agent': 'DocsPlusBot/1.0 (+https://docs.plus)',
        Accept: 'text/html, application/xhtml+xml'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    // Guard against oversized responses
    const contentLength = response.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      throw new Error('Response body exceeds maximum allowed size')
    }

    return await response.text()
  } finally {
    clearTimeout(timeoutId)
  }
}

// --- URL resolution helper ---

const resolveUrl = (path: string | undefined, baseUrl: string): string | undefined => {
  if (!path) return undefined
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  try {
    return new URL(path, baseUrl).toString()
  } catch {
    return undefined
  }
}

// --- Metadata extraction ---

/**
 * Parse OG metadata via open-graph-scraper.
 * IMPORTANT: OGS requires EITHER `url` OR `html`, never both.
 * We pass only `html` (already fetched) and use cheerio for anything OGS misses.
 * Returns a partial result on failure so extraction can continue gracefully.
 */
const parseOgs = async (html: string) => {
  try {
    // Pass only `html` — OGS throws if both `url` and `html` are provided
    const { error, result } = await ogs({ html })
    if (error) return null
    return result
  } catch {
    return null
  }
}

const extractMetadata = async (
  url: string,
  html: string
): Promise<Omit<MetadataResponse, 'success'>> => {
  const $ = cheerio.load(html)
  const result = await parseOgs(html)

  // Title — OG → Twitter → HTML <title> → hostname → fallback
  const title =
    result?.ogTitle ||
    result?.twitterTitle ||
    $('meta[property="og:title"]').attr('content') ||
    $('title').text() ||
    new URL(url).hostname ||
    'Untitled'

  // Description — OG → Twitter → meta description → undefined
  const description =
    result?.ogDescription ||
    result?.twitterDescription ||
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
    undefined

  // Image — OG → Twitter Card → cheerio fallback
  const image =
    result?.ogImage?.[0]?.url ||
    result?.twitterImage?.[0]?.url ||
    $('meta[property="og:image"]').attr('content') ||
    undefined

  // Favicon — multiple fallback sources, prefer larger sizes, resolve to absolute URL
  const faviconRaw =
    $('link[rel="icon"][type="image/svg+xml"]').attr('href') ||
    $('link[rel="icon"][sizes="32x32"]').attr('href') ||
    $('link[rel="icon"][sizes="16x16"]').attr('href') ||
    result?.favicon ||
    $('link[rel="icon"]').attr('href') ||
    $('link[rel="shortcut icon"]').attr('href') ||
    '/favicon.ico'

  // Icon/logo — prefer high-res sources for display
  const logo =
    $('link[rel="apple-touch-icon"]').attr('href') ||
    $('link[rel="apple-touch-icon-precomposed"]').attr('href') ||
    $('meta[property="og:logo"]').attr('content') ||
    $('link[rel="icon"][sizes="192x192"]').attr('href') ||
    $('link[rel="icon"][sizes="512x512"]').attr('href') ||
    $('link[rel="icon"][sizes="180x180"]').attr('href')

  // Google Favicon service as final fallback — always resolves to a usable icon
  const googleFaviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(url).origin)}&sz=64`

  // Theme color
  const themeColor =
    $('meta[name="theme-color"]').attr('content') ||
    $('meta[name="msapplication-TileColor"]').attr('content') ||
    undefined

  // Build response
  const metadata: Omit<MetadataResponse, 'success'> = {
    title: title.trim()
  }

  if (description) metadata.description = description.trim()
  if (themeColor) metadata.themeColor = themeColor.trim()

  if (image) metadata.image = resolveUrl(image, url)

  const resolvedFavicon = resolveUrl(faviconRaw, url)
  if (resolvedFavicon) metadata.favicon = resolvedFavicon

  const resolvedLogo = resolveUrl(logo, url)
  // Icon priority: high-res logo → site favicon → Google favicon service (always available)
  metadata.icon = resolvedLogo || resolvedFavicon || googleFaviconUrl

  return metadata
}

// --- Handler ---

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  // Method validation
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Only POST method allowed' })
  }

  // Rate limiting
  const clientIP =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown'

  if (!checkRateLimit(clientIP)) {
    return res.status(429).json({ success: false, message: 'Rate limit exceeded' })
  }

  // Input validation
  const { url } = req.body
  if (!url || typeof url !== 'string' || url.length > 2048) {
    return res.status(400).json({ success: false, message: 'Valid URL is required' })
  }

  if (!isValidUrl(url)) {
    return res.status(400).json({ success: false, message: 'Invalid or restricted URL' })
  }

  try {
    const html = await fetchWithTimeout(url)
    const metadata = await extractMetadata(url, html)

    // Cache successful responses (1 hour fresh, 24 hours stale-while-revalidate)
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
    res.setHeader('Vary', 'Accept-Encoding')

    return res.status(200).json({ ...metadata, success: true })
  } catch (error: unknown) {
    console.error('Metadata fetch error:', {
      url,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })

    return res.status(500).json({ success: false, message: 'Failed to fetch metadata' })
  }
}
