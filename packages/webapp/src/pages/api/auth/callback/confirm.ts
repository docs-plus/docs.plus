import createClient from '@utils/supabase/api'
import type { NextApiHandler as _NextApiHandler } from 'next'
import type { NextApiRequest, NextApiResponse } from 'next'
import { parse } from 'querystring'
import { URL } from 'url'

// Type definition for query parameters
type TQuery = {
  code?: string
  next?: string
  open_heading_chat?: string
  // OAuth google
  error?: string
  error_code?: string
  error_description?: string
}

// Function to validate URL path
const isValidPath = (path: string): boolean => {
  const regex = /^\/[a-zA-Z0-9/_-]*$/
  return regex.test(path)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // const { searchParams, origin } = new URL(request.url)

    if (req.method !== 'GET') {
      res.status(405).appendHeader('Allow', 'GET').end()
      return
    }

    const { code, next, open_heading_chat, error, error_code, error_description } = parse(
      req.url?.split('?')[1] || ''
    ) as TQuery

    if (error) {
      console.error('OAuth error:', { error, error_code, error_description })

      // Construct error page URL
      const errorUrl = new URL(
        '/auth/error',
        `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`
      )

      // Add error parameters
      errorUrl.searchParams.append('error', String(error))
      if (error_description) {
        errorUrl.searchParams.append('error_description', String(error_description))
      }
      if (error_code) {
        errorUrl.searchParams.append('error_code', String(error_code))
      }

      return res.redirect(errorUrl.toString())
    }

    if (code) {
      // const supabase = await createClient()
      const supabase = createClient(req, res)

      const { error, data: _data } = await supabase.auth.exchangeCodeForSession(code)

      if (!error) {
        // const forwardedHost = req.headers.get('x-forwarded-host') // original origin before load balancer
        // const isLocalEnv = process.env.NODE_ENV === 'development'
        // if (isLocalEnv) {
        //   // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
        //   return res.redirect(`${origin}${next}`)
        // } else if (forwardedHost) {
        //   return res.redirect(`https://${forwardedHost}${next}`)
        // } else {
        //   return res.redirect(`${origin}${next}`)
        // }
      }
    }

    // Validate and sanitize the next URL
    const baseUrl = next && isValidPath(next) ? next : '/'

    // Create a URL object from the base URL
    const url = new URL(
      baseUrl,
      `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`
    )

    // Append the search parameter if it exists and is a valid string
    if (open_heading_chat) {
      url.searchParams.append('open_heading_chat', String(open_heading_chat))
    }
    // Redirect to the modified URL
    res.redirect(url.toString())
  } catch (error) {
    console.error('Error in API handler:', error)
    res.status(500).json({ error: 'Internal Server Error' })
  }
}
