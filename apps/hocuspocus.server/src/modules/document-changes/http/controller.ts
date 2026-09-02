import type { Context } from 'hono'
import type { Logger } from 'pino'

import { fail, ok } from '../../../http/envelope'
import { captureUnknown } from '../../../lib/instrument'
import type { ChangesScope, ComputeDocumentChanges } from '../types'

export interface ChangesControllerDeps {
  compute: ComputeDocumentChanges
  logger: Logger
}

interface ChangesQuery {
  since: string
  until?: string
  scope: ChangesScope
}

/** `until` defaults here, not in the schema: a default would publish a fixed instant. */
export const createChangesHandler =
  (deps: ChangesControllerDeps) =>
  async (c: Context): Promise<Response> => {
    const { documentId } = c.req.valid('param' as never) as { documentId: string }
    const { since, until, scope } = c.req.valid('query' as never) as ChangesQuery

    const outcome = await deps.compute({
      documentId,
      since: new Date(since),
      until: until === undefined ? new Date() : new Date(until),
      scope
    })

    if (outcome.ok) return ok(c, outcome.result)

    switch (outcome.reason) {
      case 'not-found':
        return fail(c, 404, 'NOT_FOUND', 'Document not found')
      // The document exists; retention removed a row mid-request, so a retry works.
      case 'anchor-missing':
        return fail(
          c,
          404,
          'NOT_FOUND',
          'A version this window anchors on was removed while the request ran'
        )
      case 'undecodable':
        deps.logger.error({ err: outcome.error, documentId }, 'Document changes decode failed')
        captureUnknown(outcome.error, { extra: { documentId } })
        return fail(c, 500, 'INTERNAL_SERVER_ERROR', 'Stored document content could not be decoded')
    }
  }
