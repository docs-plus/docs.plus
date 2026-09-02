import type { PrismaClient } from '@prisma/client'
import type { Context, MiddlewareHandler } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import type { Logger } from 'pino'

import { fail, ok } from '../../../http/envelope'
import { type ClientAuthorBinding, resolveClientAuthors } from '../../../lib/client-authors'
import { captureUnknown } from '../../../lib/instrument'
import { distinctUserIds } from '../../../lib/profiles'
import { readContent } from '../../document-content/domain/readContent'
import { findDocumentMeta } from '../../document-content/infra/contentStore'
import { diffBlocks } from '../domain/diffBlocks'
import {
  deleteVersionRow,
  findDiffRows,
  findVersionRow,
  listVersionRows
} from '../infra/versionsStore'
import type { WsVersionsClient } from '../infra/wsVersionsClient'
import type {
  BlockChange,
  CheckpointResponseData,
  DiffAuthor,
  GetOwnerProfiles,
  ProfileLite,
  ReadFormat,
  RestoreResponseData,
  VersionDeleteResponseData,
  VersionDiffResponseData,
  VersionListItem,
  VersionListResponseData,
  VersionOps,
  VersionReadResponseData,
  VersionTrigger,
  WsCheckpointOutcome,
  WsRevertOutcome
} from '../types'
import { BACKUP_FAILED_CODE, DRAFT_DOCUMENT_CODE, VERSION_BODY_BYTES } from '../types'

// A repeat of this 500 for the same document means the per-doc debouncer is
// poisoned, and every later store rejects instantly. Retrying keeps mutating
// and broadcasting to live clients while never persisting.
const PERSIST_FAILED_MESSAGE =
  'The change may already be visible to live collaborators but was not persisted. Verify with GET before retrying; a repeat means server-side persistence is wedged.'

const OPEN_FAILED_MESSAGE = 'The document could not be opened. Nothing was changed.'

const BACKUP_FAILED_MESSAGE =
  'The pre-restore backup could not be written, so nothing was restored. The document is unchanged.'

const UPSTREAM_UNAUTHORIZED_MESSAGE =
  'The collaboration process rejected this service’s credentials. The two processes are configured with different service-role keys.'

/** Names only — a checkpoint or a restore never carries content. */
export const versionBodyLimit = (): MiddlewareHandler =>
  bodyLimit({
    maxSize: VERSION_BODY_BYTES,
    onError: (c) =>
      fail(c, 413, 'PAYLOAD_TOO_LARGE', `Request exceeds the ${VERSION_BODY_BYTES}-byte limit`)
  })

const notFound = (c: Context): Response => fail(c, 404, 'NOT_FOUND', 'Document not found')

export interface ListControllerDeps {
  prisma: PrismaClient
  logger: Logger
  getOwnerProfiles: GetOwnerProfiles
}

// Attribution is decoration: a profile-service outage must degrade to bare uids
// rather than fail the page the history sidebar is built from.
const resolveProfiles = async (
  deps: ListControllerDeps,
  userIds: string[]
): Promise<Map<string, ProfileLite>> => {
  if (userIds.length === 0) return new Map()
  try {
    const profiles = await deps.getOwnerProfiles(userIds)
    return new Map(profiles.map((profile) => [profile.id, profile]))
  } catch (error) {
    deps.logger.warn({ err: error, count: userIds.length }, 'Version attribution lookup failed')
    return new Map()
  }
}

export const createListVersionsHandler =
  (deps: ListControllerDeps) =>
  async (c: Context): Promise<Response> => {
    const documentId = c.req.param('documentId') as string
    const { limit, offset, since, until } = c.req.valid('query' as never) as {
      limit: number
      offset: number
      since?: Date
      until?: Date
    }

    if (since && until && since > until) {
      return fail(c, 400, 'VALIDATION_ERROR', 'since must not be later than until')
    }

    const meta = await findDocumentMeta(deps.prisma, documentId)
    if (!meta || meta.deletedAt) return notFound(c)

    const { rows, total } = await listVersionRows(deps.prisma, documentId, {
      limit,
      offset,
      since,
      until
    })
    const profiles = await resolveProfiles(deps, distinctUserIds(rows))

    const versions: VersionListItem[] = rows.map((row) => ({
      version: row.version,
      name: row.commitMessage || null,
      trigger: (row.trigger as VersionTrigger | null) ?? null,
      triggeredBy: (row.triggeredBy && profiles.get(row.triggeredBy)) || null,
      contributors: row.contributors
        .map((id) => profiles.get(id))
        .filter((profile): profile is ProfileLite => Boolean(profile)),
      createdAt: row.createdAt
    }))

    const body: VersionListResponseData = { documentId, versions, total, limit, offset }
    return ok(c, body)
  }

export interface ReadControllerDeps {
  prisma: PrismaClient
  logger: Logger
}

export const createGetVersionHandler =
  (deps: ReadControllerDeps) =>
  async (c: Context): Promise<Response> => {
    const { documentId, version } = c.req.valid('param' as never) as {
      documentId: string
      version: number
    }
    const { format } = c.req.valid('query' as never) as { format: ReadFormat }

    const meta = await findDocumentMeta(deps.prisma, documentId)
    if (!meta || meta.deletedAt) return notFound(c)

    const row = await findVersionRow(deps.prisma, documentId, version)
    if (!row) return fail(c, 404, 'NOT_FOUND', 'Version not found')

    const read = readContent(row.data, format)
    if (!read.ok) {
      deps.logger.error({ err: read.error, documentId, version }, 'Version snapshot decode failed')
      captureUnknown(read.error, { extra: { documentId, version } })
      return fail(c, 500, 'INTERNAL_SERVER_ERROR', 'Stored version content could not be decoded')
    }

    const body: VersionReadResponseData = {
      documentId,
      version: row.version,
      format,
      content: read.content
    }
    return ok(c, body)
  }

export type DiffControllerDeps = ListControllerDeps

// Not a cache — a byte-identical pair is ordinary. A checkpoint deliberately
// mints a named row whose content duplicates the row before it. Answering that
// without decoding is why the block counts read zero rather than the truth.
const identicalDiff = (
  documentId: string,
  fromVersion: number,
  toVersion: number
): VersionDiffResponseData => ({
  documentId,
  fromVersion,
  toVersion,
  blocksBefore: 0,
  blocksAfter: 0,
  changes: [],
  totalChanges: 0,
  coarse: false,
  unattributed: false,
  authors: []
})

// Names are decoration on both hops. Dropping them leaves `changes[].clientIds`
// intact, which is what keeps "unknown writer" distinguishable from "unattributed".
const resolveDiffAuthors = async (
  deps: DiffControllerDeps,
  documentId: string,
  changes: BlockChange[]
): Promise<DiffAuthor[]> => {
  const clientIds = new Set<number>()
  for (const change of changes) for (const clientId of change.clientIds) clientIds.add(clientId)
  if (clientIds.size === 0) return []

  let bindings: ClientAuthorBinding[]
  try {
    bindings = await resolveClientAuthors(deps.prisma, documentId, [...clientIds])
  } catch (error) {
    deps.logger.warn({ err: error, documentId }, 'Client author lookup failed')
    return []
  }
  if (bindings.length === 0) return []

  const profiles = await resolveProfiles(deps, [...new Set(bindings.map((row) => row.userId))])
  return bindings.map((binding) => ({
    clientId: binding.clientId,
    user: profiles.get(binding.userId) ?? null,
    anonymous: binding.isAnonymous
  }))
}

export const createDiffHandler =
  (deps: DiffControllerDeps) =>
  async (c: Context): Promise<Response> => {
    const { documentId, version } = c.req.valid('param' as never) as {
      documentId: string
      version: number
    }
    const { base } = c.req.valid('query' as never) as { base?: number }

    if (base !== undefined && base >= version) {
      return fail(
        c,
        400,
        'VALIDATION_ERROR',
        'base must be older than the version it is compared to'
      )
    }

    const meta = await findDocumentMeta(deps.prisma, documentId)
    if (!meta || meta.deletedAt) return notFound(c)

    const { before, after } = await findDiffRows(deps.prisma, documentId, version, base ?? null)
    if (!after) return fail(c, 404, 'NOT_FOUND', 'Version not found')
    // A named base that has no row is a caller error. A first version that has no
    // predecessor is not a caller error, and it reads as a whole document added.
    if (base !== undefined && !before) return fail(c, 404, 'NOT_FOUND', 'Base version not found')

    if (before && Buffer.compare(before.data, after.data) === 0) {
      return ok(c, identicalDiff(documentId, before.version, after.version))
    }

    const diff = diffBlocks(before, after)
    if (!diff.ok) {
      deps.logger.error(
        { err: diff.error, documentId, version, base: before?.version ?? 0 },
        'Version diff decode failed'
      )
      captureUnknown(diff.error, { extra: { documentId, version, base: before?.version ?? 0 } })
      return fail(c, 500, 'INTERNAL_SERVER_ERROR', 'Stored version content could not be decoded')
    }

    const authors = await resolveDiffAuthors(deps, documentId, diff.diff.changes)
    const body: VersionDiffResponseData = { documentId, ...diff.diff, authors }
    return ok(c, body)
  }

export interface DeleteControllerDeps {
  prisma: PrismaClient
}

export const createDeleteVersionHandler =
  (deps: DeleteControllerDeps) =>
  async (c: Context): Promise<Response> => {
    const { documentId, version } = c.req.valid('param' as never) as {
      documentId: string
      version: number
    }

    const meta = await findDocumentMeta(deps.prisma, documentId)
    if (!meta || meta.deletedAt) return notFound(c)

    const outcome = await deleteVersionRow(deps.prisma, documentId, version)
    if (outcome.status === 'head-conflict') {
      return fail(
        c,
        409,
        'CONFLICT',
        'The latest version cannot be deleted; it is the base a cold load reads.'
      )
    }
    if (outcome.status === 'not-found') return fail(c, 404, 'NOT_FOUND', 'Version not found')

    const body: VersionDeleteResponseData = { documentId, version, deleted: true }
    return ok(c, body)
  }

const checkpointResponse = (
  c: Context,
  documentId: string,
  name: string,
  outcome: WsCheckpointOutcome
): Response => {
  switch (outcome.status) {
    case 'checkpointed': {
      const body: CheckpointResponseData = { documentId, name }
      return ok(c, body)
    }
    case 'not-found':
      return notFound(c)
    case 'draft-document':
      return fail(c, 422, DRAFT_DOCUMENT_CODE, 'A document with no saved history cannot be named')
    case 'open-failed':
      return fail(c, 500, 'INTERNAL_SERVER_ERROR', OPEN_FAILED_MESSAGE)
    case 'persist-failed':
      return fail(c, 500, 'INTERNAL_SERVER_ERROR', PERSIST_FAILED_MESSAGE)
    case 'unreachable':
      return fail(c, 503, 'SERVICE_UNAVAILABLE', 'Version service is unavailable')
    case 'upstream-unauthorized':
      return fail(c, 500, 'INTERNAL_SERVER_ERROR', UPSTREAM_UNAUTHORIZED_MESSAGE)
    default: {
      const exhaustive: never = outcome
      return exhaustive
    }
  }
}

const restoreResponse = (c: Context, documentId: string, outcome: WsRevertOutcome): Response => {
  switch (outcome.status) {
    case 'reverted': {
      const body: RestoreResponseData = {
        documentId,
        restoredFrom: outcome.restoredFrom,
        backupVersion: outcome.backupVersion
      }
      return ok(c, body)
    }
    case 'not-found':
      return notFound(c)
    case 'invalid-content':
      return fail(c, 422, 'UNPROCESSABLE_ENTITY', outcome.detail)
    case 'draft-document':
      return fail(
        c,
        422,
        DRAFT_DOCUMENT_CODE,
        'A document with no saved history cannot be restored'
      )
    case 'open-failed':
      return fail(c, 500, 'INTERNAL_SERVER_ERROR', OPEN_FAILED_MESSAGE)
    case 'backup-failed':
      return fail(c, 500, BACKUP_FAILED_CODE, BACKUP_FAILED_MESSAGE)
    case 'persist-failed':
      return fail(c, 500, 'INTERNAL_SERVER_ERROR', PERSIST_FAILED_MESSAGE)
    case 'unreachable':
      return fail(c, 503, 'SERVICE_UNAVAILABLE', 'Version service is unavailable')
    case 'upstream-unauthorized':
      return fail(c, 500, 'INTERNAL_SERVER_ERROR', UPSTREAM_UNAUTHORIZED_MESSAGE)
    default: {
      const exhaustive: never = outcome
      return exhaustive
    }
  }
}

export interface OpControllerDeps {
  prisma: PrismaClient
  wsVersions: WsVersionsClient
}

export const createCheckpointHandler =
  (deps: OpControllerDeps) =>
  async (c: Context): Promise<Response> => {
    const documentId = c.req.param('documentId') as string
    const { name } = c.req.valid('json' as never) as { name: string }

    // Fast 404 without paying for the WS hop; the op re-checks anyway.
    const meta = await findDocumentMeta(deps.prisma, documentId)
    if (!meta || meta.deletedAt) return notFound(c)

    const outcome = await deps.wsVersions.checkpoint({
      documentId,
      name,
      requestId: c.get('requestId')
    })
    return checkpointResponse(c, documentId, name, outcome)
  }

export const createRestoreHandler =
  (deps: OpControllerDeps) =>
  async (c: Context): Promise<Response> => {
    const { documentId, version } = c.req.valid('param' as never) as {
      documentId: string
      version: number
    }

    const meta = await findDocumentMeta(deps.prisma, documentId)
    if (!meta || meta.deletedAt) return notFound(c)

    const outcome = await deps.wsVersions.restore({
      documentId,
      version,
      requestId: c.get('requestId')
    })
    return restoreResponse(c, documentId, outcome)
  }

export const createInternalCheckpointHandler =
  (ops: VersionOps) =>
  async (c: Context): Promise<Response> => {
    const documentId = c.req.param('documentId') as string
    const { name } = c.req.valid('json' as never) as { name: string }

    // Injected checkpoints are nobody's edit: the REST surface is service-role
    // only, so the row stays unattributed. The stateless WS op passes an actor.
    const outcome = await ops.checkpointOp(documentId, { name })
    return checkpointResponse(c, documentId, name, outcome)
  }

export const createInternalRestoreHandler =
  (ops: VersionOps) =>
  async (c: Context): Promise<Response> => {
    const { documentId, version } = c.req.valid('param' as never) as {
      documentId: string
      version: number
    }

    const outcome = await ops.revertOp(documentId, version, {})
    return restoreResponse(c, documentId, outcome)
  }
