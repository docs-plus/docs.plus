import { z } from 'zod'

import { REV_PATTERN } from '../domain/sections'

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

/** A block delete and a text edit carry no nodes, so the hop allows an empty body. */
const hopContentSchema = z.object({
  type: z.literal('doc'),
  content: z.array(z.looseObject({ type: z.string() }))
})

/** Equals `MAX_MARKDOWN_CHARS`; this file stays import-light, so the number is repeated. */
const MAX_TEXT_EDIT_CHARS = 64 * 1024
const MAX_BLOCK_POSITION = 50_000

/** The internal hop carries the mode in the body; REST has already defaulted it. */
export const internalApplyBodySchema = z
  .object({
    mode: z.enum(['replace', 'append', 'blocks', 'text']).default('replace'),
    content: hopContentSchema.default({ type: 'doc', content: [] }),
    commitMessage: commitMessageSchema.optional(),
    sectionId: z.string().trim().min(1).max(64).optional(),
    rev: z.string().regex(REV_PATTERN).optional(),
    from: z.number().int().min(0).max(MAX_BLOCK_POSITION).optional(),
    to: z.number().int().min(0).max(MAX_BLOCK_POSITION).optional(),
    oldText: z.string().min(1).max(MAX_TEXT_EDIT_CHARS).optional(),
    newText: z.string().max(MAX_TEXT_EDIT_CHARS).optional(),
    actor: actorSchema.optional()
  })
  .refine((body) => !['replace', 'append'].includes(body.mode) || body.content.content.length > 0, {
    message: 'replace and append need content'
  })
  .refine((body) => !['blocks', 'text'].includes(body.mode) || (body.sectionId && body.rev), {
    message: 'blocks and text modes need sectionId and rev'
  })
  .refine((body) => body.mode !== 'blocks' || (body.from !== undefined && body.to !== undefined), {
    message: 'blocks mode needs from and to'
  })
  .refine((body) => body.mode !== 'text' || body.oldText !== undefined, {
    message: 'text mode needs oldText'
  })
