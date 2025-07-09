import * as cookie from 'cookie'
import Config from '@config'
import { type GetServerSidePropsContext } from 'next'

export const validateTurnstileAccess = (context: GetServerSidePropsContext): boolean => {
  const cookies = cookie.parse(context.req.headers.cookie || '')

  const isTurnstileVerified = Config.app.turnstile.isEnabled
    ? cookies.turnstileVerified === 'true'
    : true

  return isTurnstileVerified
}
