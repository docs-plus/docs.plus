import { z } from 'zod'

import {
  emailBounceSchema,
  sendDigestEmailSchema,
  sendGenericEmailSchema,
  validateEmailBody
} from '../../../../schemas/email.schema'
import type { JsonSchema, OpenApiPaths } from '../../types'
import { envelopeResponse, rateLimitedRef } from '../components'
import { pathParam, toJsonSchema, toParameters } from '../jsonSchema'

const tags = ['Email']
const security = [{ serviceRoleKey: [] }]

const legacyRef = { $ref: '#/components/schemas/LegacyError' }

const serviceRoleErrors = {
  // Every email zValidator uses houseEnvelopeHook, so 400 is ErrorEnvelope.
  '400': { $ref: '#/components/responses/ValidationError' },
  '401': { $ref: '#/components/responses/LegacyUnauthorized' },
  '429': rateLimitedRef,
  '500': { $ref: '#/components/responses/LegacyInternalError' }
}

const sendResult = (extra: Record<string, JsonSchema> = {}): JsonSchema => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', const: true },
    message_id: { type: 'string' },
    ...extra
  },
  required: ['success']
})

const jsonOk = (description: string, schema: JsonSchema) => ({
  description,
  content: { 'application/json': { schema } }
})

const unsubscribeTokenParam = toParameters(z.object({ token: z.string().min(1) }), 'query', {
  token: 'The unsubscribe token is itself the credential — these routes take no auth header.'
})

export const emailPaths: OpenApiPaths = {
  '/api/email/send-generic': {
    post: {
      operationId: 'sendGenericEmail',
      summary: 'Send one email directly',
      description:
        'Notification delivery normally runs through pgmq (`email_queue` → pg_cron → pgmq → worker → BullMQ → the configured provider, SMTP or Resend); this is an internal trigger, not that path. `POST /api/email/send` was removed.',
      tags,
      security,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: toJsonSchema(sendGenericEmailSchema) } }
      },
      responses: {
        '200': jsonOk('Queued or sent.', sendResult()),
        ...serviceRoleErrors
      }
    }
  },
  '/api/email/send-digest': {
    post: {
      operationId: 'sendDigestEmail',
      summary: 'Send a daily or weekly digest',
      tags,
      security,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: toJsonSchema(sendDigestEmailSchema) } }
      },
      responses: {
        '200': jsonOk('Queued or sent.', sendResult()),
        ...serviceRoleErrors
      }
    }
  },
  '/api/email/bounce': {
    post: {
      operationId: 'recordEmailBounce',
      summary: 'Record a provider bounce event',
      description: 'Hard bounces auto-suppress the affected user.',
      tags,
      security,
      requestBody: {
        required: true,
        content: { 'application/json': { schema: toJsonSchema(emailBounceSchema) } }
      },
      responses: {
        '200': jsonOk(
          'Recorded.',
          sendResult({ bounce_id: {}, auto_suppressed: { type: 'boolean' } })
        ),
        ...serviceRoleErrors
      }
    }
  },
  '/api/email/webhooks/resend': {
    post: {
      operationId: 'receiveResendWebhook',
      summary: 'Receive a Resend delivery event',
      description:
        'Mounted only when `RESEND_WEBHOOK_SECRET` is set and valid; otherwise 404. Authenticated by the Svix signature over the raw body, not by a key. A permanent bounce, a complaint or a suppression is recorded through `record_email_bounce`, which turns email off for that user. `email.failed` is logged for the operator alert. Each `svix-id` is recorded once; a redelivery answers 200 and writes nothing.',
      tags,
      security: [{}],
      parameters: [
        {
          name: 'svix-id',
          in: 'header',
          required: true,
          description: 'Message id, `msg_` then 1 to 64 letters or digits. The dedupe key.',
          schema: { type: 'string', pattern: '^msg_[A-Za-z0-9]{1,64}$' }
        },
        {
          name: 'svix-timestamp',
          in: 'header',
          required: true,
          description: 'Unix seconds. Refused when more than 5 minutes from server time.',
          schema: { type: 'string', pattern: '^\\d{1,12}$' }
        },
        {
          name: 'svix-signature',
          in: 'header',
          required: true,
          description:
            'Space-separated `v1,<base64>` HMAC-SHA256 signatures of `<svix-id>.<svix-timestamp>.<raw body>`.',
          schema: { type: 'string' }
        }
      ],
      requestBody: {
        required: true,
        description: 'A Resend webhook event. At most 64 KiB.',
        content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } }
      },
      responses: {
        '200': jsonOk('Recorded, ignored, or already recorded.', {
          type: 'object',
          properties: {
            success: { type: 'boolean', const: true },
            data: {
              type: 'object',
              properties: { received: { type: 'boolean', const: true } },
              required: ['received']
            }
          },
          required: ['success', 'data']
        }),
        '400': envelopeResponse('The signed body is not JSON.'),
        '401': envelopeResponse('Missing, malformed, stale or wrong signature. One body for all.'),
        '409': envelopeResponse('Another request is still recording this `svix-id`. Retry later.'),
        '413': envelopeResponse('Body exceeds 64 KiB.'),
        '429': rateLimitedRef,
        '500': envelopeResponse('The event was not recorded. Retry later.'),
        '503': envelopeResponse('Redis failed, so nothing was recorded. Retry later.')
      }
    }
  },
  '/api/email/health': {
    get: {
      operationId: 'getEmailHealth',
      summary: 'Email gateway health',
      tags,
      security: [{}],
      responses: {
        '200': jsonOk('Gateway health report.', { type: 'object', additionalProperties: true }),
        '429': rateLimitedRef,
        '500': { $ref: '#/components/responses/LegacyInternalError' }
      }
    }
  },
  '/api/email/status': {
    get: {
      operationId: 'getEmailStatus',
      summary: 'Email gateway operational flag',
      tags,
      security: [{}],
      responses: {
        '200': jsonOk('Operational flag.', {
          type: 'object',
          properties: {
            operational: { type: 'boolean' },
            timestamp: { type: 'string', format: 'date-time' }
          },
          required: ['operational', 'timestamp']
        }),
        '429': rateLimitedRef
      }
    }
  },
  '/api/email/validate': {
    post: {
      operationId: 'validateEmail',
      summary: 'Check an email address for the magic-link form',
      description:
        'Public. Returns `{ isValid }` on 200 for both results. Uses the house regex, then an MX lookup. Does not wrap success in the house envelope.',
      tags,
      security: [{}],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: toJsonSchema(validateEmailBody) } }
      },
      responses: {
        '200': jsonOk('Regex and MX result.', {
          type: 'object',
          properties: { isValid: { type: 'boolean' } },
          required: ['isValid']
        }),
        '400': { $ref: '#/components/responses/ValidationError' },
        '429': rateLimitedRef
      }
    }
  },
  '/api/email/preview/{type}': {
    get: {
      operationId: 'previewEmailTemplate',
      summary: 'Render an email template with sample data',
      tags,
      security,
      parameters: [
        pathParam('type', 'Template to render.', {
          type: 'string',
          enum: ['notification', 'digest']
        })
      ],
      responses: {
        '200': {
          description: 'Rendered template.',
          content: { 'text/html': { schema: { type: 'string' } } }
        },
        '400': {
          description: 'Unknown template type.',
          content: { 'application/json': { schema: legacyRef } }
        },
        '401': { $ref: '#/components/responses/LegacyUnauthorized' },
        '429': rateLimitedRef
      }
    }
  },
  '/api/email/unsubscribe': {
    get: {
      operationId: 'unsubscribeViaLink',
      summary: 'One-click unsubscribe from an email link',
      description:
        'Verifies the token in the worker, applies the change through the `apply_unsubscribe` Supabase RPC, and always renders an HTML confirmation page — failures are rendered, not status-coded.',
      tags,
      security: [{}],
      parameters: unsubscribeTokenParam,
      responses: {
        '200': {
          description: 'Confirmation or error page.',
          content: { 'text/html': { schema: { type: 'string' } } }
        },
        '429': rateLimitedRef
      }
    },
    post: {
      operationId: 'unsubscribeOneClick',
      summary: 'RFC 8058 List-Unsubscribe-Post handler',
      description: 'The JSON counterpart mail clients call.',
      tags,
      security: [{}],
      parameters: unsubscribeTokenParam,
      responses: {
        '200': jsonOk('Unsubscribed.', {
          type: 'object',
          properties: { success: { type: 'boolean', const: true } },
          required: ['success']
        }),
        '400': {
          description:
            'Missing token from zValidator (house envelope), or an invalid or expired token from the handler (`LegacyError`).',
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  { $ref: '#/components/schemas/ErrorEnvelope' },
                  { $ref: '#/components/schemas/LegacyError' }
                ]
              }
            }
          }
        },
        '429': rateLimitedRef,
        '500': { $ref: '#/components/responses/LegacyInternalError' }
      }
    }
  }
}
