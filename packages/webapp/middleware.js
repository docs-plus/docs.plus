import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import { serialize } from 'cookie'

export async function middleware(req) {
  const res = NextResponse.next()
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return res

  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session }
  } = await supabase.auth.getSession().catch((err) => {
    console.error('Error getting session:', err)
  })

  if (session) {
    // Serialize the user id into a cookie
    const userIdCookie = serialize('user-id', session.user.id, { path: '/' })
    // Add the cookie to the response headers
    res.headers.set('Set-Cookie', userIdCookie)
  }
}
