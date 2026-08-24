import { logger } from '@utils/logger'
import { type NextRequest, NextResponse } from 'next/server'

/** Runs on the Edge Runtime — keep it lightweight and free of Node-only APIs. */
export async function proxy(request: NextRequest) {
  const startTime = Date.now()
  const requestId = crypto.randomUUID()
  const { pathname, searchParams } = request.nextUrl

  // new.{domain} → a fresh random document, mirrored by the /new page route.
  const hostname = request.headers.get('host') || ''
  if (hostname.startsWith('new.')) {
    const randomSlug = (Math.random() + 1).toString(36).substring(2)
    const mainHost = hostname.replace(/^new\./, '')
    return NextResponse.redirect(`${request.nextUrl.protocol}//${mainHost}/${randomSlug}`, 307)
  }

  if (searchParams.has('error') && searchParams.has('error_code')) {
    const errorUrl = new URL('/auth/error', request.url)
    const errorDescription = searchParams.get('error_description')
    if (errorDescription) {
      errorUrl.searchParams.set('error_description', errorDescription)
    }
    return NextResponse.redirect(errorUrl)
  }

  const response = NextResponse.next({
    request: { headers: request.headers }
  })

  response.headers.set('X-Request-ID', requestId)

  // Sampled at 10% for page routes to keep log volume down; API routes always log.
  if (process.env.NODE_ENV === 'production') {
    const isApiRoute = pathname.startsWith('/api/')
    const shouldLog = isApiRoute || Math.random() < 0.1

    if (shouldLog) {
      try {
        const ip =
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          request.headers.get('x-real-ip') ||
          'unknown'

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

  response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`)

  return response
}

export const config = {
  matcher: [
    // Excludes _next internals, api routes (they log themselves), .well-known,
    // and static assets.
    '/((?!_next|api|\\.well-known|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$).*)'
  ]
}
