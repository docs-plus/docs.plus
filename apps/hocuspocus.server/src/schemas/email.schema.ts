import { z } from 'zod'

export const sendGenericEmailSchema = z.object({
  to: z.string().email('Invalid email address'),
  subject: z.string().min(1, 'Subject is required').max(200),
  html: z.string().min(1, 'HTML content is required').max(100000),
  text: z.string().max(50000).optional(),
  replyTo: z.string().email().optional()
})

export const emailBounceSchema = z.object({
  email: z.string().email('Invalid email address'),
  bounce_type: z.enum(['hard', 'soft', 'complaint']),
  provider: z.string().max(50).optional(),
  reason: z.string().max(1000).optional()
})

export const validateEmailBody = z.object({ email: z.string() })
