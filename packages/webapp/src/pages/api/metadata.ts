import * as cheerio from 'cheerio'
import type { NextApiRequest, NextApiResponse } from 'next'
import ogs from 'open-graph-scraper'

interface MetadataResponse {
  title: string
  image?: string
  icon?: string
  favicon?: string
  success: true
}

interface ErrorResponse {
  success: false
  message: string
}

type ApiResponse = MetadataResponse | ErrorResponse

// Simple in-memory rate limiting (use Redis for production clusters)
const requestCounts = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 50 // requests per minute
const RATE_WINDOW = 60 * 1000 // 1 minute

const isValidUrl = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url)
    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return false
    }
    // Block localhost and internal IPs for security
    const hostname = parsedUrl.hostname
    if (
      hostname === 'localhost' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)
    ) {
      return false
    }
    return true
  } catch {
    return false
  }
}

const checkRateLimit = (ip: string): boolean => {
  const now = Date.now()
  const userRequests = requestCounts.get(ip)

  if (!userRequests || now > userRequests.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_WINDOW })
    return true
  }

  if (userRequests.count >= RATE_LIMIT) {
    return false
  }

  userRequests.count++
  return true
}

const fetchWithTimeout = async (url: string, timeout = 10000): Promise<string> => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow'
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()
    return html
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Resolves a relative URL to an absolute URL
 */
const resolveUrl = (path: string | undefined, baseUrl: string): string | undefined => {
  if (!path) return undefined
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  try {
    return new URL(path, baseUrl).toString()
  } catch {
    return undefined
  }
}

const extractMetadata = async (
  url: string,
  html: string
): Promise<Omit<MetadataResponse, 'success'>> => {
  // Parse HTML with cheerio for favicon/logo extraction
  const $ = cheerio.load(html)
  const _baseUrl = new URL(url)

  // Use open-graph-scraper for Open Graph and Twitter Card data
  const ogsResult = await ogs({ url, html })

  if (ogsResult.error) {
    throw new Error(`Failed to parse metadata: ${ogsResult.error}`)
  }

  const result = ogsResult.result

  // Extract title with fallbacks
  // Note: open-graph-scraper doesn't have a direct 'title' property
  // Use ogTitle, twitterTitle, or fallback to HTML title tag
  const title =
    result.ogTitle ||
    result.twitterTitle ||
    // @ts-ignore - result may have title in some cases but type doesn't reflect it
    result.title ||
    $('title').text() ||
    new URL(url).hostname ||
    'Untitled'

  // Extract image (Open Graph or Twitter Card)
  const image = result.ogImage?.[0]?.url || result.twitterImage?.[0]?.url

  // Extract favicon from various sources
  const favicon =
    result.favicon ||
    $('link[rel="icon"]').attr('href') ||
    $('link[rel="shortcut icon"]').attr('href') ||
    $('link[rel="apple-touch-icon"]').attr('href') ||
    '/favicon.ico'

  // Extract logo (Open Graph logo or Apple touch icon)
  const logo =
    result.ogLogo ||
    $('meta[property="og:logo"]').attr('content') ||
    $('link[rel="apple-touch-icon"]').attr('href') ||
    $('link[rel="icon"][sizes="192x192"]').attr('href') ||
    $('link[rel="icon"][sizes="512x512"]').attr('href')

  // Build the result object with proper handling of all icon types
  const metadata: Omit<MetadataResponse, 'success'> = {
    title: title.trim()
  }

  // Add image if available
  if (image) {
    metadata.image = resolveUrl(image, url)
  }

  // Add favicon if available
  const resolvedFavicon = resolveUrl(favicon, url)
  if (resolvedFavicon) {
    metadata.favicon = resolvedFavicon
  }

  // Add icon (logo) if available, fallback to favicon if no logo exists
  const resolvedLogo = resolveUrl(logo, url)
  if (resolvedLogo) {
    metadata.icon = resolvedLogo
  } else if (resolvedFavicon) {
    // If no logo/icon was found, use favicon as fallback icon
    metadata.icon = resolvedFavicon
  }

  return metadata
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  // Method validation
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Only POST method allowed'
    })
  }

  // Rate limiting
  const clientIP =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    req.socket.remoteAddress ||
    'unknown'
  if (!checkRateLimit(clientIP)) {
    return res.status(429).json({
      success: false,
      message: 'Rate limit exceeded'
    })
  }

  // Input validation
  const { url } = req.body
  if (!url || typeof url !== 'string' || url.length > 2048) {
    return res.status(400).json({
      success: false,
      message: 'Valid URL is required'
    })
  }

  if (!isValidUrl(url)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or restricted URL'
    })
  }

  try {
    const html = await fetchWithTimeout(url)
    const metadata = await extractMetadata(url, html)

    // Set cache headers for successful responses
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
    res.setHeader('Vary', 'Accept-Encoding')

    return res.status(200).json({
      ...metadata,
      success: true
    })
  } catch (error: unknown) {
    // Log error for monitoring (use proper logger in production)
    console.error('Metadata fetch error:', {
      url,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch metadata'
    })
  }
}
