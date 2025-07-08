import type { NextApiRequest, NextApiResponse } from 'next'
import metascraper from 'metascraper'
import metascraperTitle from 'metascraper-title'
import metascraperDescription from 'metascraper-description'
import metascraperImage from 'metascraper-image'
import metascraperLogo from 'metascraper-logo'
import metascraperLogoFavicon from 'metascraper-logo-favicon'

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

// Initialize metascraper with plugins including the new favicon plugin
const scraper = metascraper([
  metascraperTitle(),
  metascraperDescription(),
  metascraperImage(),
  metascraperLogo(),
  metascraperLogoFavicon()
])

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

const extractMetadata = async (
  url: string,
  html: string
): Promise<Omit<MetadataResponse, 'success'>> => {
  const metadata = await scraper({ url, html })

  // Fallback title if none found
  const title =
    metadata.title ||
    metadata.description?.slice(0, 60) + '...' ||
    new URL(url).hostname ||
    'Untitled'

  console.log('extractMetadata - Raw metadata:', {
    title: metadata.title,
    description: metadata.description,
    image: metadata.image,
    logo: metadata.logo,
    favicon: metadata.favicon
  })

  // Build the result object with proper handling of all icon types
  const result: Omit<MetadataResponse, 'success'> = {
    title: title.trim()
  }

  // Add image if available
  if (metadata.image) {
    result.image = metadata.image
  }

  // Add icon (logo) if available
  if (metadata.logo) {
    result.icon = metadata.logo
  }

  // Add favicon if available (prioritize favicon over logo for icon field if no logo exists)
  if (metadata.favicon) {
    result.favicon = metadata.favicon
    // If no logo/icon was found, use favicon as fallback icon
    if (!result.icon) {
      result.icon = metadata.favicon
    }
  }

  console.log('extractMetadata - Final result:', result)

  return result
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

    console.log('API Response metadata:', metadata)

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
