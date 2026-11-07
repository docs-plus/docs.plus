import {
  AuthApiError,
  AuthPKCECodeVerifierMissingError,
  AuthRetryableFetchError
} from '@supabase/supabase-js'

import {
  describeCodeExchangeError,
  describeEmailLinkError,
  describeReturnErrorCode,
  describeTokenHashError
} from './signInErrors'

const apiError = (code: string, message = 'server text', status = 400) =>
  new AuthApiError(message, status, code)

describe('describeEmailLinkError', () => {
  it('turns the per-email wait into a countdown, never the raw text', () => {
    const problem = describeEmailLinkError(
      apiError(
        'over_email_send_rate_limit',
        'For security purposes, you can only request this after 20 seconds.',
        429
      )
    )
    expect(problem.retryInSeconds).toBe(20)
    expect(problem.message).toMatch(/just sent a link/)
    expect(problem.message).not.toMatch(/security purposes/)
  })

  it('counts the last second of the window as one second', () => {
    const problem = describeEmailLinkError(
      apiError(
        'over_email_send_rate_limit',
        'For security purposes, you can only request this after 0 seconds.',
        429
      )
    )
    expect(problem.retryInSeconds).toBe(1)
  })

  it('never claims a link was just sent when no wait is named', () => {
    const problem = describeEmailLinkError(
      apiError('over_email_send_rate_limit', 'Email rate limit exceeded', 429)
    )
    expect(problem.retryInSeconds).toBeUndefined()
    expect(problem.message).not.toMatch(/just sent/)
  })

  it.each([
    ['over_request_rate_limit', /this network/],
    ['email_address_invalid', /real email address/],
    ['validation_failed', /valid email/],
    ['email_address_not_authorized', /can't send email/],
    ['otp_disabled', /off right now/]
  ])('maps %s by its code', (code, expected) => {
    expect(describeEmailLinkError(apiError(code)).message).toMatch(expected)
  })

  it('reads a network failure or a foreign throw as unreachable', () => {
    expect(describeEmailLinkError(new AuthRetryableFetchError('Load failed', 0)).message).toMatch(
      /couldn't reach/
    )
    expect(describeEmailLinkError(new TypeError('Failed to fetch')).message).toMatch(
      /couldn't reach/
    )
  })

  it('hides an unknown server message behind a generic line', () => {
    expect(describeEmailLinkError(apiError('unexpected_failure', 'smtp 535')).message).not.toMatch(
      /smtp/
    )
  })
})

describe('describeTokenHashError', () => {
  it('explains a spent link and a network failure', () => {
    expect(describeTokenHashError(apiError('otp_expired', 'x', 403))).toMatch(/works once/)
    expect(describeTokenHashError(new AuthRetryableFetchError('Load failed', 0))).toMatch(
      /couldn't reach/
    )
  })
})

describe('the paths Google shares', () => {
  // Google sign-in returns through `?code=` and `?error_code=` too.
  it('never names an email or a link on a `?code=` return', () => {
    for (const error of [
      new AuthPKCECodeVerifierMissingError(),
      apiError('validation_failed'),
      new AuthRetryableFetchError('Load failed', 0)
    ]) {
      expect(describeCodeExchangeError(error)).not.toMatch(/email|link/i)
    }
  })

  it('keeps email wording for `otp_expired` only', () => {
    expect(describeReturnErrorCode('otp_expired')).toMatch(/sign-in link/)
    expect(describeReturnErrorCode('access_denied')).not.toMatch(/email|link/i)
  })
})
