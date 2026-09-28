import type { CallToolResult } from '@modelcontextprotocol/server'
import type { PrismaClient } from '@prisma/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { JSONContent } from '@tiptap/core'
import type { Logger } from 'pino'

import type { TokenVerifyOutcome } from '../../lib/auth'
import type { RedisClient } from '../../types/redis.types'
import type { ContentClient } from '../document-content'

/** The most text one read returns: a document, a section or a chat page. */
export const MAX_READ_CHARS = 100_000

export type VerifyToken = (token: string) => Promise<TokenVerifyOutcome>

/** The person behind the OAuth grant. Every tool runs as this caller. */
export interface Caller {
  sub: string
  email?: string
  isAnonymous: boolean
  clientId: string
}

export interface InitDeps {
  prisma: PrismaClient
  logger: Logger
  content: ContentClient
  verifyToken: VerifyToken
  /** `PUBLIC_RESTAPI_URL`, origin only. Unset falls back to the request origin. */
  publicBaseUrl: string | null
  /** Supabase Auth's `issuer`, exactly as its openid-configuration reports it. */
  authIssuer: string
  /** A present `Origin` outside this list gets 403. Server-side hosts send none. */
  allowedOrigins: readonly string[]
  /** Holds the per-caller tool budget and the usage counts. Null runs without both. */
  redis: RedisClient | null
  /** The service-role client for the chat tools. Null turns them into a refusal. */
  supabase: SupabaseClient | null
  version: string
}

export interface ServerFactoryDeps {
  prisma: PrismaClient
  logger: Logger
  content: ContentClient
  budget: ToolBudget
  usage: RecordUsage
  /** Null when Supabase is not configured; the chat tools then refuse. */
  chat: ChatStore | null
  version: string
}

/** One request's caller and the steps every tool shares. */
export interface ToolContext {
  caller: Caller
  /** Budget, refusal, one log line and one usage count around each call. */
  run: <A>(
    tool: string,
    handler: (args: A) => Promise<CallToolResult>
  ) => (args: A) => Promise<CallToolResult>
  /** `own` also refuses a document the caller can read but does not own. */
  openDocument: (slug: string, need: 'read' | 'own') => Promise<DocumentRecord>
  loadContent: (doc: DocumentRecord) => Promise<JSONContent>
}

/** Why a Markdown fragment cannot be written: its title rule, or no content. */
export type FragmentProblem = 'empty' | 'missing-title' | 'extra-title' | 'title-not-allowed'

/** A document row as the tools see it: enough to resolve a slug and decide access. */
export interface DocumentRecord {
  documentId: string
  slug: string
  isPrivate: boolean
  readOnly: boolean
  ownerId: string | null
  deletedAt: Date | null
}

export interface DocumentListing {
  slug: string
  title: string | null
  updatedAt: Date
  isPrivate: boolean
  readOnly: boolean
  ownerId: string | null
}

export interface OutlineNode {
  /** The heading's `toc-id`: `section_id` for reads and writes. */
  id: string | null
  level: number
  title: string
  rev: string | null
  children: OutlineNode[]
}

export type ToolBudget = (sub: string) => Promise<{ ok: true } | { ok: false; retryAfter: number }>

export type ToolOutcome = 'ok' | 'rate-limited' | 'tool-error' | 'error'

/** Counts one tool call. Returns at once; a lost count never fails the call. */
export type RecordUsage = (call: {
  tool: string
  outcome: ToolOutcome
  clientId: string
  sub: string
}) => void

/** Usage counts for a window of UTC days, oldest day first. */
export interface McpUsage {
  days: { day: string; calls: number; callers: number }[]
  /** Distinct callers across the whole window. */
  callers: number
  tools: { tool: string; outcome: string; calls: number }[]
  /** Calls per OAuth `client_id`. The admin route turns ids into app names. */
  clientCalls: Record<string, number>
}

export interface ChatRoom {
  id: string
  messageCount: number
  lastActivityAt: string | null
}

export interface ChatMessage {
  seq: number
  username: string | null
  createdAt: string
  content: string
  type: string
  isReply: boolean
  attachmentCount: number
}

export interface ChatStore {
  listRooms: (documentId: string) => Promise<ChatRoom[]>
  hasRoom: (documentId: string, roomId: string) => Promise<boolean>
  readThread: (
    documentId: string,
    roomId: string,
    page: { beforeSeq?: number; limit: number }
  ) => Promise<{ messages: ChatMessage[]; hasMore: boolean }>
  postMessage: (row: {
    id: string
    roomId: string
    userId: string
    content: string
    html: string
  }) => Promise<{ seq: number }>
}
