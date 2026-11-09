import { z } from 'zod'

import { MAX_MARKDOWN_CHARS } from '../../document-conversion/types'
import { REV_PATTERN } from '../domain/sections'
import { APPLY_MODES } from '../types'

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

/** The modes that write the whole document, the only ones REST offers. */
const wholeDocMode = z.enum(APPLY_MODES).extract(['replace', 'append'])

export const patchQuerySchema = z.object({
  mode: wholeDocMode.default('replace')
})

export type PatchQuery = z.infer<typeof patchQuerySchema>

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

/** A block delete and an all-media rewrite carry no new nodes, so these allow an empty body. */
const hopContentSchema = z.object({
  type: z.literal('doc'),
  content: z.array(z.looseObject({ type: z.string() }))
})

const MAX_BLOCK_POSITION = 50_000

const blockPosition = z.number().int().min(0).max(MAX_BLOCK_POSITION)

const keptBlockSchema = z.object({ block: blockPosition, at: blockPosition })

const sectionRef = {
  sectionId: z.string().trim().min(1).max(64),
  rev: z.string().regex(REV_PATTERN)
}

const shared = { commitMessage: commitMessageSchema.optional(), actor: actorSchema.optional() }

/**
 * Each mode carries exactly its own fields. Plain objects strip unknown keys, which is why a
 * new edit is a new mode name: an old replica would strip a new field and widen the edit.
 * `keep` is required, not defaulted: a dropped list would read as "keep nothing".
 */
export const internalApplyBodySchema = z.discriminatedUnion('mode', [
  z.object({
    mode: wholeDocMode,
    content: tiptapDocSchema,
    ...shared
  }),
  z.object({
    mode: z.literal('blocks'),
    content: hopContentSchema,
    from: blockPosition,
    to: blockPosition,
    ...sectionRef,
    ...shared
  }),
  z.object({
    mode: z.literal('text'),
    oldText: z.string().min(1).max(MAX_MARKDOWN_CHARS),
    newText: z.string().max(MAX_MARKDOWN_CHARS),
    ...sectionRef,
    ...shared
  }),
  z.object({
    mode: z.literal('move'),
    from: blockPosition,
    to: blockPosition,
    ...sectionRef,
    ...shared
  }),
  z.object({
    mode: z.literal('rewrite'),
    content: hopContentSchema,
    keep: z.array(keptBlockSchema).max(MAX_BLOCK_POSITION),
    ...sectionRef,
    ...shared
  })
])

export type InternalApplyBody = z.infer<typeof internalApplyBodySchema>
