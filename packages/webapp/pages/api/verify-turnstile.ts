import type { NextApiRequest, NextApiResponse } from 'next'
import { serialize } from 'cookie'
import Config from '@config'

interface TurnstileResponse {
  success: boolean
  'error-codes'?: string[]
  challenge_ts?: string
  hostname?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' })
  }

  const { token } = req.body

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ success: false, message: 'Invalid or missing token' })
  }

  const secretKey = process.env.NEXT_PRIVATE_TURNSTILE_SECRET_KEY
  if (!secretKey) {
    console.error('NEXT_PRIVATE_TURNSTILE_SECRET_KEY is not configured')
    return res.status(500).json({ success: false, message: 'Server misconfigured' })
  }

  try {
    const formData = new FormData()
    formData.append('secret', secretKey)
    formData.append('response', token)

    // Get real IP address
    const forwarded = req.headers['x-forwarded-for']
    const ip = forwarded ? forwarded.toString().split(',')[0] : req.socket.remoteAddress
    if (ip) {
      formData.append('remoteip', ip)
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(5000) // Reduced timeout
    })

    if (!response.ok) {
      throw new Error(`Cloudflare API returned ${response.status}`)
    }

    const data: TurnstileResponse = await response.json()

    if (data.success) {
      // Set verification cookie
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

      return res.status(200).json({ success: true })
    } else {
      console.warn('Turnstile verification failed:', data['error-codes'] || 'Unknown error')
      return res.status(400).json({
        success: false,
        message: 'Verification failed',
        errors: data['error-codes']
      })
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      console.error('Turnstile verification timeout')
      return res.status(504).json({ success: false, message: 'Verification timeout' })
    }

    console.error('Turnstile verification error:', error)
    return res.status(500).json({ success: false, message: 'Verification failed' })
  }
}
