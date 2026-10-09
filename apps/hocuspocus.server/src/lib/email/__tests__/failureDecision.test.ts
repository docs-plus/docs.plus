import { describe, expect, test } from 'bun:test'

import { decideEmailFailure } from '../failureDecision'
import { classifyResendError } from '../providers/resend'
import { classifySmtpError } from '../providers/smtp'
import { EmailSendError } from '../providers/types'

const ATTEMPTS = 6
// attemptsMade counts prior attempts, so 5 is the sixth and last run.
const LAST = ATTEMPTS - 1
const NOT_LAST = 2

const failure = (kind: 'transient' | 'permanent' | 'operator') =>
  new EmailSendError(kind, 'code', 'message')

describe('decideEmailFailure', () => {
  test('retries a transient failure until the last attempt', () => {
    expect(decideEmailFailure(failure('transient'), NOT_LAST, ATTEMPTS)).toBe('retry')
    expect(decideEmailFailure(failure('transient'), LAST - 1, ATTEMPTS)).toBe('retry')
    expect(decideEmailFailure(failure('transient'), LAST, ATTEMPTS)).toBe('dead-letter')
  })

  test('dead-letters a permanent failure on any attempt', () => {
    expect(decideEmailFailure(failure('permanent'), NOT_LAST, ATTEMPTS)).toBe('dead-letter')
    expect(decideEmailFailure(failure('permanent'), LAST, ATTEMPTS)).toBe('dead-letter')
  })

  test('dead-letters an operator failure on any attempt', () => {
    expect(decideEmailFailure(failure('operator'), 0, ATTEMPTS)).toBe('dead-letter')
    expect(decideEmailFailure(failure('operator'), LAST, ATTEMPTS)).toBe('dead-letter')
  })

  test('treats an error that is not an EmailSendError as transient', () => {
    expect(decideEmailFailure(new Error('template exploded'), NOT_LAST, ATTEMPTS)).toBe('retry')
    expect(decideEmailFailure('a string', NOT_LAST, ATTEMPTS)).toBe('retry')
  })
})

describe('provider error maps', () => {
  test('maps a 422 validation_error naming subject to permanent', () => {
    expect(classifyResendError('validation_error', 422, 'Missing `subject` field.')).toBe(
      'permanent'
    )
  })

  test('maps a 403 validation_error for an unverified domain to operator', () => {
    expect(classifyResendError('validation_error', 403, 'The domain is not verified.')).toBe(
      'operator'
    )
  })

  test('maps a quota error to operator even though it arrives as 429', () => {
    expect(classifyResendError('daily_quota_exceeded', 429, 'Quota reached')).toBe('operator')
  })

  // nodemailer stamps EAUTH on a throttle too; paging on it was a false alarm.
  test('maps an SMTP 454 with EAUTH to transient, and a 535 to operator', () => {
    expect(classifySmtpError('EAUTH', 454, '454 4.7.0 Try again later')).toBe('transient')
    expect(classifySmtpError('EAUTH', 535, '535 5.7.8 Authentication failed')).toBe('operator')
  })
})
