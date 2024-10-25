import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'
import { serialize } from 'cookie'
import Config from '@config'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { token } = req.body

  if (!token) {
    return res.status(400).json({ success: false, message: 'No token provided.' })
  }

  try {
    const secretKey = process.env.TURNSTILE_SECRET_KEY!
    // Add a check for the secret key
    if (!secretKey) {
      console.error('TURNSTILE_SECRET_KEY is not set')
      return res.status(500).json({ success: false, message: 'Server configuration error.' })
    }

    const verifyEndpoint = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

    const params = new URLSearchParams()
    params.append('secret', secretKey)
    params.append('response', token)
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    if (ip) {
      params.append('remoteip', ip.toString())
    }

    const response = await fetch(verifyEndpoint, {
      method: 'POST',
      body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}`,
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      }
    })

    const data = await response.json()
    // Add more detailed logging

    if (data.success) {
      // Set a cookie to indicate verification success
      res.setHeader(
        'Set-Cookie',
        serialize('turnstileVerified', 'true', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: Config.app.turnstile.expireTime,
          path: '/'
        })
      )

      return res.status(200).json(data)
    } else {
      // Log the error codes if available
      if (data['error-codes']) {
        console.error('Turnstile verification failed with error codes:', data['error-codes'])
      }
      return res.status(200).json({ success: false, message: 'Verification failed.' })
    }
  } catch (error) {
    // Improve error logging
    if (error instanceof Error) {
      console.error('Error verifying Turnstile token:', error.message)
    } else if (axios.isAxiosError(error) && error.response) {
      console.error('Error verifying Turnstile token:', error.response.data)
    } else {
      console.error('Error verifying Turnstile token:', error)
    }
    return res.status(500).json({ success: false, message: 'Internal server error.' })
  }
}
