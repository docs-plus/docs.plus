import { z } from 'zod'

export const sendGenericEmailSchema = z.object({
  to: z.string().email('Invalid email address'),
  subject: z.string().min(1, 'Subject is required').max(200),
  html: z.string().min(1, 'HTML content is required').max(100000),
  text: z.string().max(50000).optional(),
  replyTo: z.string().email().optional()
})

export const sendDigestEmailSchema = z.object({
  to: z.string().email('Invalid email address'),
  frequency: z.enum(['daily', 'weekly']),
  documents: z
    .array(
      z.object({
        slug: z.string(),
        title: z.string().optional(),
        update_count: z.number().optional(),
        last_activity: z.string().optional()
      })
    )
    .min(1, 'At least one document is required'),
  user_name: z.string().max(100).optional(),
  unsubscribe_token: z.string().optional()
})

export const emailBounceSchema = z.object({
  email: z.string().email('Invalid email address'),
  bounce_type: z.enum(['hard', 'soft', 'complaint']),
  provider: z.string().max(50).optional(),
  reason: z.string().max(1000).optional()
})
