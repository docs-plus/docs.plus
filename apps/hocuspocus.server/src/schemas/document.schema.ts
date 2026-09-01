import { z } from 'zod'

// Deep path on purpose: the module's `http/schema` is zod-only, so importing it
// here never drags Tiptap or the transformer into this file's consumers.
import { tiptapDocSchema } from '../modules/document-content/http/schema'

const plainTitle = (title: string): string => title.replace(/<[^>]*>/g, '')

export const createDocumentSchema = z.object({
  title: z.string().transform(plainTitle).pipe(z.string().min(1, 'Title is required')),
  slug: z.string().min(1, 'Slug is required'),
  description: z.string().optional().default(''),
  keywords: z.array(z.string()).optional().default([]),
  // Service-role only — a user JWT presenting either field gets a 403.
  content: tiptapDocSchema.optional(),
  ownerId: z.string().optional()
})

export const updateDocumentMetadataSchema = z.object({
  title: z.string().transform(plainTitle).optional(),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  readOnly: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
  // URL slug for anchoring a draft on its first metadata write; used only when the
  // row is created (see updateDocument). Ignored on update — never renames a doc.
  slug: z.string().optional()
})

export const documentQuerySchema = z.object({
  title: z.string().optional(),
  keywords: z.string().optional(),
  description: z.string().optional(),
  // Filter by owner — used by the Settings → Documents "Mine" pill.
  ownerId: z.string().uuid().optional(),
  // Trash view — the owner's soft-deleted docs, auto-scoped to the token subject.
  deleted: z.enum(['true', 'false']).optional(),
  // Allowlisted sort — maps to a fixed Prisma orderBy in the service.
  sort: z
    .enum(['updatedAt_desc', 'createdAt_desc', 'title_asc', 'title_desc'])
    .optional()
    .default('updatedAt_desc'),
  limit: z.string().optional().default('10'),
  offset: z.string().optional().default('0')
})

export const userIdQuerySchema = z.object({
  userId: z.string().optional()
})

// Bulk Trash purge — omit `ids` to empty the whole trash; pass ids to purge a
// selection. The `ids` path is capped at 500. The empty-all path is bounded only
// by the owner's own trash size, small in practice because the 30-day reaper caps
// growth. Both run sequentially — see purgeTrash for the synchronous-scale note.
export const trashPurgeSchema = z.object({
  ids: z.array(z.string().min(1)).max(500).optional()
})

// Bulk Trash restore — at least one id; each is owner-gated in the service.
export const trashRestoreSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500)
})

export const setDocumentFavoriteSchema = z.object({
  favorite: z.boolean()
})

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>
export type UpdateDocumentMetadataInput = z.infer<typeof updateDocumentMetadataSchema>
export type DocumentQueryInput = z.infer<typeof documentQuerySchema>
export type TrashPurgeInput = z.infer<typeof trashPurgeSchema>
export type TrashRestoreInput = z.infer<typeof trashRestoreSchema>
export type SetDocumentFavoriteInput = z.infer<typeof setDocumentFavoriteSchema>
