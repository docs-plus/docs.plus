import { z } from 'zod'

/**
 * Shape-level only — encode checks content expressions. Import-light on
 * purpose: `src/schemas/document.schema.ts` imports this file, so pulling
 * the transformer in here would drag Tiptap into every consumer.
 */
export const tiptapDocSchema = z.object({
  type: z.literal('doc'),
  content: z.array(z.looseObject({ type: z.string() })).min(1)
})

/** The exact ShortUniqueId `stamp(19)` shape — a 62-char alphanumeric alphabet. */
export const documentIdSchema = z.string().regex(/^[0-9A-Za-z]{19}$/)

export const documentIdParamSchema = z.object({ documentId: documentIdSchema })

export const contentQuerySchema = z.object({
  format: z.enum(['json', 'text']).default('json')
})

export const patchQuerySchema = z.object({
  mode: z.enum(['replace', 'append']).default('replace')
})

const commitMessageSchema = z.string().trim().min(1).max(200)

export const patchBodySchema = z.object({
  content: tiptapDocSchema,
  commitMessage: commitMessageSchema.optional()
})

/** Bounded so the hop body stays inside INTERNAL_BODY_HEADROOM_BYTES. */
const actorSchema = z.object({
  sub: z.string().min(1).max(128),
  email: z.string().max(254).optional()
})

/** The internal hop carries the mode in the body; REST has already defaulted it. */
export const internalApplyBodySchema = z
  .object({
    mode: z.enum(['replace', 'append', 'section']).default('replace'),
    content: tiptapDocSchema,
    commitMessage: commitMessageSchema.optional(),
    sectionId: z.string().min(1).max(64).optional(),
    rev: z
      .string()
      .regex(/^[0-9a-f]{12}$/)
      .optional(),
    actor: actorSchema.optional()
  })
  .refine((body) => body.mode !== 'section' || (body.sectionId && body.rev), {
    message: 'section mode needs sectionId and rev'
  })
