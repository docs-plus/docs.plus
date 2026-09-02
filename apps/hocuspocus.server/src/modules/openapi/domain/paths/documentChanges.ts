import { changesQuerySchema, documentIdParamSchema } from '../../../document-changes/http/schema'
import type { OpenApiPaths } from '../../types'
import { rateLimitedRef } from '../components'
import { dataEnvelope, DOCUMENT_ID_NOTE, toParameters } from '../jsonSchema'

export const documentChangesPaths: OpenApiPaths = {
  '/api/documents/{documentId}/changes': {
    get: {
      operationId: 'getDocumentChanges',
      summary: 'Summarise what changed in a document over a time window',
      description:
        "Compares the newest stored snapshot at or before `since` with the newest at or before `until`, and reports the result per heading section. Read-only: nothing is written and no live document is loaded.\n\n**`createdAt` is commit time, not edit time.** A version row is inserted by the persistence worker after a debounce of 10 s idle or 60 s maximum, so `until=now` can miss the last minute of typing. Day-scale windows are unaffected; minute-precision windows are illusory.\n\n**`changed` is derived from the section statuses, never from the bytes.** A window that only spans the editor's first-open `toc-id` stamping pass has different bytes and no real edit, and reports `changed: false`.\n\n**Magnitude is best-effort.** `magnitude` is null when the edit changed formatting rather than words — a bold run, a changed link address, a heading level — because the comparison reads neither marks nor attributes. The status still says `modified`: the edit happened, only its size is unknown.\n\n**Attribution is decoration.** It is per-replica and best-effort, anonymous editors are omitted, and retention thinning under-reports contributors on windows longer than the autosave retention. A profile-lookup outage empties `contributors` rather than failing the request. The content comparison stays correct in every one of those cases.\n\nA `404` means either that the document has no metadata row or that retention removed a version this window anchors on while the request ran; the message says which, and the second is worth retrying.\n\nNeither 413 nor 503 can occur: the route takes no body, and it never hops to the collaboration process.",
      tags: ['Document changes'],
      security: [{ serviceRoleKey: [] }],
      parameters: [
        ...toParameters(documentIdParamSchema, 'path', { documentId: DOCUMENT_ID_NOTE }),
        ...toParameters(changesQuerySchema, 'query', {
          since:
            'Required. Inclusive lower bound on `createdAt`, not on the version number. An ISO 8601 instant carrying an offset.',
          until:
            'Inclusive upper bound on `createdAt`. Defaults to the moment the request is served. Equal to `since` is allowed and reports no change.',
          scope:
            '`summary` returns counts only. `headings` adds `sections`, the full outline tree including unchanged headings. `sections` is empty whenever no comparison ran, which the fast paths below describe.'
        })
      ],
      responses: {
        '200': {
          description:
            'Baseline and head anchors, whether anything changed, and the rollup. `baseline` and `head` are both null when no snapshot exists at or before `until`.',
          content: {
            'application/json': {
              schema: dataEnvelope({ type: 'object', additionalProperties: true })
            }
          }
        },
        '400': { $ref: '#/components/responses/ValidationError' },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': { $ref: '#/components/responses/NotFound' },
        '429': rateLimitedRef,
        '500': { $ref: '#/components/responses/InternalError' }
      }
    }
  }
}
