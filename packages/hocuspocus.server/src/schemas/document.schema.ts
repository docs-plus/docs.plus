import { z } from 'zod'

export const createDocumentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  slug: z.string().min(1, 'Slug is required'),
  description: z.string().optional().default(''),
  keywords: z.array(z.string()).optional().default([])
})

export const updateDocumentMetadataSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  readOnly: z.boolean().optional()
})

export const documentQuerySchema = z.object({
  title: z.string().optional(),
  keywords: z.string().optional(),
  description: z.string().optional(),
  limit: z.string().optional().default('10'),
  offset: z.string().optional().default('0')
})

export const userIdQuerySchema = z.object({
  userId: z.string().optional()
})

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>
export type UpdateDocumentMetadataInput = z.infer<typeof updateDocumentMetadataSchema>
export type DocumentQueryInput = z.infer<typeof documentQuerySchema>
