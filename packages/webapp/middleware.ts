import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const startTime = Date.now()
  const requestId = crypto.randomUUID()

  // Check for error-related query parameters
  const searchParams = request.nextUrl.searchParams
  const hasError = searchParams.has('error')
  const hasErrorCode = searchParams.has('error_code')
  const errorDescription = searchParams.get('error_description')

  if (hasError && hasErrorCode && errorDescription) {
    const errorUrl = new URL('/auth/error', request.url)
    // Preserve error information in the redirect
    if (errorDescription) {
      errorUrl.searchParams.set('error_description', errorDescription)
    }
    return NextResponse.redirect(errorUrl)
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers
    }
  })

  // Add request tracking headers
  response.headers.set('X-Request-ID', requestId)
  response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`)

  // Log request in production (simplified middleware logging)
  if (process.env.NODE_ENV === 'production') {
    const logData = {
      requestId,
      method: request.method,
      url: request.url,
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime
    }

    // Log to console (PM2 will capture this)
    console.log(
      JSON.stringify({
        level: 'info',
        message: 'Request processed',
        type: 'middleware_request',
        ...logData
      })
    )
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    // Only match index.tsx and [...slug].tsx routes
    '/',
    '/:slug*'
  ]
}
