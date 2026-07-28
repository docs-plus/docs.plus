import { z } from 'zod'

/**
 * Shape-level only — the real gate is the encode step, which checks content
 * expressions against the authoring schema. Kept import-light on purpose:
 * `src/schemas/document.schema.ts` imports this file, so pulling the
 * transformer in here would drag Tiptap into every consumer of that module.
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

/** Names the version row the apply mints; the trimmed value is the stored `commitMessage`. */
const commitMessageSchema = z.string().trim().min(1).max(200)

export const patchBodySchema = z.object({
  content: tiptapDocSchema,
  commitMessage: commitMessageSchema.optional()
})

/** The internal hop carries the mode in the body; REST has already defaulted it. */
export const internalApplyBodySchema = z.object({
  mode: z.enum(['replace', 'append']).default('replace'),
  content: tiptapDocSchema,
  commitMessage: commitMessageSchema.optional()
})
