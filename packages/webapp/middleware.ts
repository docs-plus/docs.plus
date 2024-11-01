import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
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
