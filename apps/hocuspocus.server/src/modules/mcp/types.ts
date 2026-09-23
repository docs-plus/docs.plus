import type { PrismaClient } from '@prisma/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Logger } from 'pino'

import type { TokenVerifyOutcome } from '../../lib/auth'
import type { RedisClient } from '../../types/redis.types'
import type { ContentClient } from '../document-content'

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
  /** Holds the per-caller tool budget. Null runs without one. */
  redis: RedisClient | null
  /** The service-role client for the chat tools. Null turns them into a refusal. */
  supabase: SupabaseClient | null
  version: string
}

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
