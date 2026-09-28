import type { CallToolResult } from '@modelcontextprotocol/server'
import { z } from 'zod'

import { decideDocumentAccess, type DocumentAccess } from '../../../lib/documentAccess'
import { findDocumentBySlug } from '../infra/documentStore'
import type { Caller, ServerFactoryDeps, ToolContext, ToolOutcome } from '../types'

export const reply = (
  text: string,
  structuredContent?: Record<string, unknown>
): CallToolResult => ({
  content: [{ type: 'text', text }],
  ...(structuredContent ? { structuredContent } : {})
})

export const toolError = (text: string): CallToolResult => ({
  content: [{ type: 'text', text }],
  isError: true
})

// A refusal the agent can act on. `run` turns it into a tool error, never a logged failure.
class ToolRefusal extends Error {}

export const refuse = (text: string): never => {
  throw new ToolRefusal(text)
}

export const notFoundText = (slug: string): string =>
  `slug: no document "${slug}" is open to you. Call find_documents to list your documents.`

const privateText = (slug: string): string =>
  `slug: "${slug}" is private. Only its owner can open it.`

const ACCESS_TEXT: Record<Exclude<DocumentAccess, 'allow'>, (slug: string) => string> = {
  'not-found': notFoundText,
  'sign-in-required': privateText,
  denied: privateText,
  'read-only': (slug) => `slug: "${slug}" is read-only. Only its owner can edit it.`
}

// Maintainer ruling 2026-09-23. Text an agent reads could steer it to leak data.
// So a connected app writes and posts only in the caller's own documents.
const notOwnerText = (slug: string) =>
  `slug: "${slug}" belongs to another person. A connected app can write and post only in documents you own. Make this change in docs.plus yourself.`

export const slugField = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .describe('The document slug, as in its URL')
export const sectionIdField = z.string().trim().min(1).max(64)

export const createToolContext = (deps: ServerFactoryDeps, caller: Caller): ToolContext => ({
  caller,

  // Never log arguments: they carry private document text.
  run: (tool, handler) => async (args) => {
    const started = performance.now()
    let outcome: ToolOutcome = 'ok'
    try {
      const budget = await deps.budget(caller.sub)
      if (!budget.ok) {
        outcome = 'rate-limited'
        return toolError(
          `Too many docs.plus tool calls. Wait ${budget.retryAfter} seconds, then retry.`
        )
      }
      const result = await handler(args)
      if (result.isError) outcome = 'tool-error'
      return result
    } catch (err) {
      if (err instanceof ToolRefusal) {
        outcome = 'tool-error'
        return toolError(err.message)
      }
      outcome = 'error'
      deps.logger.error({ err, tool }, 'MCP tool failed')
      return toolError('docs.plus failed to run this tool. Retry in a moment.')
    } finally {
      deps.logger.info(
        {
          tool,
          sub: caller.sub,
          clientId: caller.clientId,
          outcome,
          durationMs: Math.round(performance.now() - started)
        },
        'MCP tool call'
      )
      deps.usage({ tool, outcome, clientId: caller.clientId, sub: caller.sub })
    }
  },

  openDocument: async (slug, need) => {
    const doc = await findDocumentBySlug(deps.prisma, slug)
    if (!doc) return refuse(notFoundText(slug))
    const access = decideDocumentAccess(
      doc,
      { userId: caller.sub, isAnonymous: caller.isAnonymous },
      'read'
    )
    if (access !== 'allow') return refuse(ACCESS_TEXT[access](slug))
    if (need === 'own' && doc.ownerId !== caller.sub) return refuse(notOwnerText(slug))
    return doc
  },

  loadContent: async (doc) => {
    const read = await deps.content.read(doc.documentId)
    if (read.status === 'ok') return read.content
    if (read.status === 'not-found') return refuse(notFoundText(doc.slug))
    return refuse('docs.plus could not read the document right now. Retry in a moment.')
  }
})
