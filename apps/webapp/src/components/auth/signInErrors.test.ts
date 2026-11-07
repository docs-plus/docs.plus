import {
  AuthApiError,
  AuthPKCECodeVerifierMissingError,
  AuthRetryableFetchError
} from '@supabase/supabase-js'

import {
  describeEmailLinkError,
  describeLinkErrorCode,
  describeLinkLandingError
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

describe('describeLinkLandingError', () => {
  it('sends an old PKCE link back to a fresh sign-in', () => {
    expect(describeLinkLandingError(new AuthPKCECodeVerifierMissingError())).toMatch(
      /works in any browser/
    )
  })

  it('names an older email when the code no longer matches the verifier', () => {
    expect(describeLinkLandingError(apiError('validation_failed'))).toMatch(/from an older email/)
  })

  it('separates a network failure from a spent link', () => {
    expect(describeLinkLandingError(new AuthRetryableFetchError('Load failed', 0))).toMatch(
      /could not be reached/
    )
    expect(describeLinkLandingError(apiError('flow_state_expired'))).toMatch(/expired/)
  })
})

describe('describeLinkErrorCode', () => {
  it('explains a spent link and stays generic for anything else', () => {
    expect(describeLinkErrorCode('otp_expired')).toMatch(/works once, for 1 hour/)
    expect(describeLinkErrorCode('server_error')).not.toMatch(/works once/)
  })
})
