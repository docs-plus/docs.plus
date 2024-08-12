import { NextApiHandler } from 'next'
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { URL } from 'url'
import { parse } from 'querystring'

// Type definition for query parameters
type TQuery = {
  code?: string
  next?: string
  open_heading_chat?: string
}

// Function to validate URL path
const isValidPath = (path: string): boolean => {
  const regex = /^\/[a-zA-Z0-9/_-]*$/
  return regex.test(path)
}

const handler: NextApiHandler = async (req, res) => {
  try {
    const { code, next, open_heading_chat } = parse(req.url?.split('?')[1] || '') as TQuery

    if (code) {
      const supabase = createPagesServerClient({ req, res })
      await supabase.auth.exchangeCodeForSession(String(code))
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

export default handler
