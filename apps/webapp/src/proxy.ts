import { logger } from '@utils/logger'
import { type NextRequest, NextResponse } from 'next/server'

/**
 * Middleware for request handling, error redirects, and logging
 * Runs on Edge Runtime - keep it lightweight and fast
 */
export async function proxy(request: NextRequest) {
  const startTime = Date.now()
  const requestId = crypto.randomUUID()
  const { pathname, searchParams } = request.nextUrl

  // Handle new.{domain} → create random doc and redirect
  const hostname = request.headers.get('host') || ''
  if (hostname.startsWith('new.')) {
    const randomSlug = (Math.random() + 1).toString(36).substring(2)
    const mainHost = hostname.replace(/^new\./, '')
    return NextResponse.redirect(`${request.nextUrl.protocol}//${mainHost}/${randomSlug}`, 307)
  }

  // Handle auth error redirects (from OAuth providers)
  if (searchParams.has('error') && searchParams.has('error_code')) {
    const errorUrl = new URL('/auth/error', request.url)
    const errorDescription = searchParams.get('error_description')
    if (errorDescription) {
      errorUrl.searchParams.set('error_description', errorDescription)
    }
    return NextResponse.redirect(errorUrl)
  }

  // Create response with request headers preserved
  const response = NextResponse.next({
    request: { headers: request.headers }
  })

  // Add request tracking headers (useful for debugging and monitoring)
  response.headers.set('X-Request-ID', requestId)

  // Log in production (sampled to reduce volume)
  // Edge runtime doesn't have access to all Node.js APIs, keep logging minimal
  if (process.env.NODE_ENV === 'production') {
    const isApiRoute = pathname.startsWith('/api/')
    const shouldLog = isApiRoute || Math.random() < 0.1

    if (shouldLog) {
      try {
        const ip =
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          request.headers.get('x-real-ip') ||
          'unknown'

        // Use structured logging - logger handles production filtering internally
        logger.structured('info', 'Request processed', {
          requestId,
          method: request.method,
          path: pathname,
          ip,
          duration: `${Date.now() - startTime}ms`
        })
      } catch {
        // Silently fail - logging shouldn't break requests
      }
    }
  }

  // Set response time header after processing
  response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`)

  return response
}

export const config = {
  matcher: [
    /*
     * Exclude:
     * - _next/* (Next.js internals)
     * - api/* (API routes - handle logging there)
     * - .well-known/* (system paths)
     * - Static assets (images, fonts, etc.)
     */
    '/((?!_next|api|\\.well-known|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$).*)'
  ]
}
