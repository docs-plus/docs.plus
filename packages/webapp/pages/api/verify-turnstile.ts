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

    if (data.success) {
      // Set a cookie to indicate verification success
      res.setHeader(
        'Set-Cookie',
        cookie.serialize('turnstileVerified', 'true', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'Strict', // Prevent the cookie from being sent with cross-site requests
          maxAge: Config.app.turnstile.expireTime,
          path: '/'
        })
      )

      return res.status(200).json({ success: true })
    } else {
      return res.status(200).json({ success: false, message: 'Verification failed.' })
    }
  } catch (error) {
    console.error('Error verifying Turnstile token:', error)
    return res.status(500).json({ success: false, message: 'Internal server error.' })
  }
}
