import type { PrismaClient } from '@prisma/client'
import type { Logger } from 'pino'

import type { VerifyServiceRole } from '../../http/serviceRole'
import type { GetOwnerProfiles, ProfileLite } from '../../lib/profiles'

export type { GetOwnerProfiles, ProfileLite, VerifyServiceRole }

/** Body excerpt on a changed section. Long enough to recognise a paragraph. */
export const EXCERPT_MAX_CHARS = 140

/** Heading text, capped for the same reason as the excerpt — it also rides an email. */
export const SECTION_TEXT_MAX_CHARS = 200

export type SectionStatus = 'added' | 'removed' | 'modified' | 'unchanged'

export type ChangesScope = 'summary' | 'headings'

export interface SectionMagnitude {
  wordsAdded: number
  wordsRemoved: number
  blocksBefore: number
  blocksAfter: number
}

/**
 * One heading and the top-level nodes that follow it. The heading node stays
 * whole so the canonical hash covers its level, its text and its marks at once.
 */
export interface Section {
  tocId: string | null
  /** 0 marks the synthetic preamble, which owns no heading and never nests. */
  level: number
  headingText: string
  heading: Record<string, unknown> | null
  nodes: Record<string, unknown>[]
}

/** Both-null is unrepresentable: pairing never emits a pair with no side. */
export type SectionPair =
  | { baseline: Section; head: Section }
  | { baseline: Section; head: null }
  | { baseline: null; head: Section }

export interface SectionChange {
  tocId: string | null
  text: string
  level: number
  status: SectionStatus
  /** Null when nothing countable moved — a formatting-only edit, or a throw. */
  magnitude: SectionMagnitude | null
  excerpt?: string
}

export interface SectionNode extends SectionChange {
  children: SectionNode[]
}

export interface ChangeSummary {
  sectionsAdded: number
  sectionsRemoved: number
  sectionsModified: number
  wordsAdded: number
  wordsRemoved: number
  versions: number
  triggers: string[]
  contributors: ProfileLite[]
}

export interface AnchorRef {
  version: number
  createdAt: Date
}

export interface DocumentChangesResult {
  documentId: string
  since: Date
  until: Date
  baseline: AnchorRef | null
  head: AnchorRef | null
  changed: boolean
  summary: ChangeSummary
  /** Present only for `scope=headings`. Empty whenever no comparison ran. */
  sections?: SectionNode[]
}

export type ComputeFailureReason = 'not-found' | 'anchor-missing' | 'undecodable'

export type ComputeOutcome =
  | { ok: true; result: DocumentChangesResult }
  | { ok: false; reason: 'not-found' | 'anchor-missing' }
  | { ok: false; reason: 'undecodable'; error: unknown }

export interface AnchorRow extends AnchorRef {
  id: number
}

export interface WindowRow {
  trigger: string | null
  triggeredBy: string | null
  contributors: string[]
}

export interface SnapshotBytes {
  id: number
  /** Prisma maps `Bytes` to `Uint8Array`, which has no `.equals` — compare with `Buffer.compare`. */
  data: Uint8Array
}

export interface ChangesStore {
  findMeta: (documentId: string) => Promise<{ deletedAt: Date | null } | null>
  resolveAnchor: (documentId: string, at: Date) => Promise<AnchorRow | null>
  fetchWindow: (documentId: string, afterVersion: number, toVersion: number) => Promise<WindowRow[]>
  fetchPairBytes: (ids: number[]) => Promise<SnapshotBytes[]>
}

export interface ComputeDeps {
  prisma: PrismaClient
  logger: Logger
  getOwnerProfiles: GetOwnerProfiles
}

export interface ComputeRequest {
  documentId: string
  since: Date
  until: Date
  scope: ChangesScope
}

export type ComputeDocumentChanges = (request: ComputeRequest) => Promise<ComputeOutcome>

export interface InitDeps extends ComputeDeps {
  verifyServiceRole: VerifyServiceRole
}
