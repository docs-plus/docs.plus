// import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
// import { NextResponse } from 'next/server'
// import { serialize } from 'cookie'

// export async function middleware(req) {
//   const res = NextResponse.next()
//   if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return res

//   const supabase = createMiddlewareClient({ req, res })

//   const {
//     data: { session }
//   } = await supabase.auth.getSession().catch((err) => {
//     console.error('Error getting session:', err)
//   })

//   if (session) {
//     // Serialize the user id into a cookie
//     const userIdCookie = serialize('user-id', session.user.id, { path: '/' })
//     // Add the cookie to the response headers
//     res.headers.set('Set-Cookie', userIdCookie)
//   }
// }

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers
    }
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options
          })
          response = NextResponse.next({
            request: {
              headers: request.headers
            }
          })
          response.cookies.set({
            name,
            value,
            ...options
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options
          })
          response = NextResponse.next({
            request: {
              headers: request.headers
            }
          })
          response.cookies.set({
            name,
            value: '',
            ...options
          })
        }
      }
    }
  )

  await supabase.auth.getSession()

  return response
}
