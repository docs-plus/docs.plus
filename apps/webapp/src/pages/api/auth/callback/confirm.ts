import createClient from '@utils/supabase/api'
import type { NextApiRequest, NextApiResponse } from 'next'
import { parse } from 'querystring'
import { URL } from 'url'

type TQuery = {
  code?: string
  next?: string
  open_heading_chat?: string
  error?: string
  error_code?: string
  error_description?: string
}

const isValidPath = (path: string): boolean => {
  const regex = /^\/[a-zA-Z0-9/_-]*$/
  return regex.test(path)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET') {
      res.status(405).appendHeader('Allow', 'GET').end()
      return
    }

    const { code, next, open_heading_chat, error, error_code, error_description } = parse(
      req.url?.split('?')[1] || ''
    ) as TQuery

    if (error) {
      console.error('OAuth error:', { error, error_code, error_description })

      const errorUrl = new URL(
        '/auth/error',
        `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`
      )

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
      const supabase = createClient(req, res)
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

      if (exchangeError) {
        console.error('Code exchange failed:', exchangeError)
        const errorUrl = new URL(
          '/auth/error',
          `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`
        )
        errorUrl.searchParams.append('error', exchangeError.message)
        errorUrl.searchParams.append('error_code', exchangeError.status?.toString() || '500')
        return res.redirect(errorUrl.toString())
      }
    }

    const baseUrl = next && isValidPath(next) ? next : '/'

    const url = new URL(
      baseUrl,
      `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`
    )

    if (open_heading_chat) {
      url.searchParams.append('open_heading_chat', String(open_heading_chat))
    }
    res.redirect(url.toString())
  } catch (error) {
    console.error('Error in API handler:', error)
    res.status(500).json({ error: 'Internal Server Error' })
  }
}
