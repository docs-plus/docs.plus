import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'
import cookie from 'cookie'
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

    const siteverifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

    const params = new URLSearchParams()
    params.append('secret', secretKey)
    params.append('response', token)
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    if (ip) {
      params.append('remoteip', ip.toString())
    }

    const response = await axios.post(siteverifyUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })

    const data = response.data

    // Add more detailed logging
    console.log('Turnstile verification response:', data)

    if (data.success) {
      // Set a cookie to indicate verification success
      res.setHeader(
        'Set-Cookie',
        cookie.serialize('turnstileVerified', 'true', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict', // Prevent the cookie from being sent with cross-site requests
          maxAge: Config.app.turnstile.expireTime,
          path: '/'
        })
      )

      return res.status(200).json({ success: true })
    } else {
      // Log the error codes if available
      if (data['error-codes']) {
        console.error('Turnstile verification failed with error codes:', data['error-codes'])
      }
      return res.status(200).json({ success: false, message: 'Verification failed.' })
    }
  } catch (error) {
    // Improve error logging
    console.error('Error verifying Turnstile token:', error.response?.data || error.message)
    return res.status(500).json({ success: false, message: 'Internal server error.' })
  }
}
