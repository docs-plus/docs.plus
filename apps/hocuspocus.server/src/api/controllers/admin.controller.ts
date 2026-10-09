import { fail, ok } from '../../http/envelope'
import {
  readDigestGrouping,
  readDigestMaxKb,
  writeDigestGrouping,
  writeDigestMaxKb
} from '../../lib/email/digestGrouping'
import { adminLogger } from '../../lib/logger'
import { getRedisClient } from '../../lib/redis'
import { readMcpUsage } from '../../modules/mcp/infra/usageStore'
import type { DigestSettingsBody, McpUsageQuery } from '../../schemas/admin.schema'
import type { AppContext } from '../../types/hono.types'
import * as stats from '../services/adminStats.service'
import { getSupabaseClient } from '../utils/supabase'

export * from './admin-analytics.controller'
export * from './admin-audit.controller'
export * from './admin-stats.controller'

export async function getDashboardStats(c: AppContext) {
  try {
    return c.json(await stats.getDashboardStats(c.get('prisma')))
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get dashboard stats')
    return c.json({ error: 'Failed to fetch statistics' }, 500)
  }
}

export async function getDocumentStats(c: AppContext) {
  try {
    return c.json(await stats.getDocumentStats(c.get('prisma')))
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get document stats')
    return c.json({ error: 'Failed to fetch document statistics' }, 500)
  }
}

export async function listDocuments(c: AppContext) {
  try {
    const result = await stats.listDocuments(c.get('prisma'), {
      page: parseInt(c.req.query('page') || '1'),
      limit: Math.min(parseInt(c.req.query('limit') || '20'), 100),
      sortBy: c.req.query('sortBy') || 'updatedAt',
      sortDir: c.req.query('sortDir') === 'asc' ? 'asc' : 'desc',
      search: c.req.query('search') || ''
    })
    return c.json(result)
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to list documents')
    return c.json({ error: 'Failed to fetch documents' }, 500)
  }
}

export async function updateDocument(c: AppContext) {
  try {
    const idRaw = c.req.param('id')
    if (idRaw === undefined) return c.json({ error: 'Missing document ID' }, 400)
    const id = parseInt(idRaw, 10)
    if (isNaN(id)) return c.json({ error: 'Invalid document ID' }, 400)

    const body = await c.req.json()
    const updateData: Record<string, boolean> = {}
    for (const field of ['isPrivate', 'readOnly']) {
      if (typeof body[field] === 'boolean') updateData[field] = body[field]
    }
    if (Object.keys(updateData).length === 0) {
      return c.json({ error: 'No valid fields to update' }, 400)
    }

    return c.json(await stats.updateDocumentFlags(c.get('prisma'), id, updateData))
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to update document')
    return c.json({ error: 'Failed to update document' }, 500)
  }
}

export async function getDocumentDeletionImpact(c: AppContext) {
  try {
    const idRaw = c.req.param('id')
    if (idRaw === undefined) return c.json({ error: 'Missing document ID' }, 400)
    const id = parseInt(idRaw, 10)
    if (isNaN(id)) return c.json({ error: 'Invalid document ID' }, 400)

    const impact = await stats.getDocumentDeletionImpact(c.get('prisma'), id)
    if (!impact) return c.json({ error: 'Document not found' }, 404)
    return c.json(impact)
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get deletion impact')
    return c.json({ error: 'Failed to analyze deletion impact' }, 500)
  }
}

/** Deletes the document's whole footprint across both databases, not just the row. */
export async function deleteDocument(c: AppContext) {
  try {
    const idRaw = c.req.param('id')
    if (idRaw === undefined) return c.json({ error: 'Missing document ID' }, 400)
    const id = parseInt(idRaw, 10)
    if (isNaN(id)) return c.json({ error: 'Invalid document ID' }, 400)

    const body = await c.req.json().catch(() => ({}))
    const result = await stats.deleteDocument(c.get('prisma'), id, body.confirmSlug)

    if (result.status === 'not_found') return c.json({ error: 'Document not found' }, 404)
    if (result.status === 'mismatch') {
      return c.json({ error: 'Confirmation slug does not match' }, 400)
    }
    return c.json({
      success: result.success,
      deleted: result.deleted,
      workspaceDeleted: result.workspaceDeleted
    })
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to delete document')
    return c.json({ error: 'Failed to delete document' }, 500)
  }
}

export async function getUserDocumentCounts(c: AppContext) {
  try {
    return c.json(await stats.getUserDocumentCounts(c.get('prisma')))
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to get user document counts')
    return c.json({ error: 'Failed to fetch user document counts' }, 500)
  }
}

export async function toggleAdminRole(c: AppContext) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

    const userId = c.req.param('id')
    if (!userId) return c.json({ error: 'Missing user id' }, 400)
    const currentAdminId = c.get('userId')
    if (userId === currentAdminId) {
      return c.json({ error: 'Cannot change your own admin status' }, 403)
    }

    const result = await stats.toggleAdminRole(supabase, userId, currentAdminId)
    if (result.status === 'last_admin') {
      return c.json({ error: 'Cannot remove the last admin' }, 403)
    }
    if (result.status === 'error') throw new Error(result.message)
    return c.json({ success: true, is_admin: result.is_admin })
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to toggle admin role')
    return c.json({ error: 'Failed to toggle admin role' }, 500)
  }
}

export async function getDigestGrouping(c: AppContext) {
  try {
    const redis = getRedisClient()
    return c.json({
      grouping: await readDigestGrouping(redis),
      maxKb: await readDigestMaxKb(redis)
    })
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to read digest grouping')
    return c.json({ error: 'Failed to read digest grouping' }, 500)
  }
}

export async function setDigestGrouping(c: AppContext) {
  const { grouping, maxKb } = c.req.valid('json' as never) as DigestSettingsBody
  const redis = getRedisClient()
  if (!redis) return c.json({ error: 'Redis is not available' }, 503)
  try {
    if (grouping) await writeDigestGrouping(redis, grouping)
    if (maxKb !== undefined) await writeDigestMaxKb(redis, maxKb)
    return c.json({
      grouping: await readDigestGrouping(redis),
      maxKb: await readDigestMaxKb(redis)
    })
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to save digest grouping')
    return c.json({ error: 'Failed to save digest grouping' }, 500)
  }
}

const UNKNOWN_APP = 'Unknown app'

const originOf = (uri: string): string | null => {
  try {
    return new URL(uri).origin
  } catch {
    return null
  }
}

// GoTrue v2.196 ignores page and per_page here and returns every client, so a
// page loop would repeat page 1; auth-js also misreads pages from 10 up. One
// large call, and a warning if Auth ever starts paging this list.
const OAUTH_CLIENTS_PER_PAGE = 1000

async function listOAuthClients() {
  const supabase = getSupabaseClient()
  if (!supabase) return null
  const { data, error } = await supabase.auth.admin.oauth.listClients({
    perPage: OAUTH_CLIENTS_PER_PAGE
  })
  if (error) {
    adminLogger.warn({ err: error }, 'Failed to list OAuth clients')
    return null
  }
  if (data.total > data.clients.length) {
    adminLogger.warn(
      { total: data.total, returned: data.clients.length },
      'OAuth client list is paged; the rest count as Unknown app'
    )
  }
  return data.clients
}

// A count of 1 to 4 people could point at one person, so it never leaves the server.
const maskSmallCount = (count: number): number | '<5' => (count > 0 && count < 5 ? '<5' : count)

/**
 * Counts are grouped by app name, never by client id or caller. Dynamic
 * registration makes one client per install, so an id row can be one person.
 */
export async function getMcpUsage(c: AppContext) {
  const { days } = c.req.valid('query' as never) as McpUsageQuery
  try {
    const [usage, clients] = await Promise.all([
      readMcpUsage(getRedisClient(), days),
      listOAuthClients()
    ])
    const nameOf = new Map(clients?.map((client) => [client.client_id, client.client_name]))
    const appCalls = new Map<string, number>()
    for (const [clientId, calls] of Object.entries(usage?.clientCalls ?? {})) {
      const name = nameOf.get(clientId) || UNKNOWN_APP
      appCalls.set(name, (appCalls.get(name) ?? 0) + calls)
    }
    return ok(c, {
      available: usage !== null,
      days: usage?.days.map((day) => ({ ...day, callers: maskSmallCount(day.callers) })) ?? [],
      callers: maskSmallCount(usage?.callers ?? 0),
      tools: usage?.tools ?? [],
      apps: [...appCalls]
        .map(([name, calls]) => ({ name, calls }))
        .sort((a, b) => b.calls - a.calls),
      registeredApps:
        clients
          ?.map((client) => ({
            name: client.client_name || UNKNOWN_APP,
            createdAt: client.created_at,
            redirectOrigins: [
              ...new Set(client.redirect_uris.map(originOf).filter((o) => o !== null))
            ]
          }))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)) ?? null
    })
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to read MCP usage')
    return fail(c, 500, 'MCP_USAGE_FAILED', 'Failed to read MCP usage')
  }
}

export async function getAdminUserIds(c: AppContext) {
  try {
    const supabase = getSupabaseClient()
    if (!supabase) return c.json({ error: 'Supabase not configured' }, 500)

    const result = await stats.getAdminUserIds(supabase)
    if (result.status === 'error') throw new Error(result.message)
    return c.json(result.data)
  } catch (error) {
    adminLogger.error({ err: error }, 'Failed to fetch admin user IDs')
    return c.json({ error: 'Failed to fetch admin users' }, 500)
  }
}
