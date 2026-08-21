import {
  checkpointBodySchema,
  contentQuerySchema,
  diffQuerySchema,
  documentIdParamSchema,
  listQuerySchema,
  versionParamSchema
} from '../../../document-versions/http/schema'
import type { OpenApiPaths, OpenApiResponse } from '../../types'
import { envelopeResponse, rateLimitedRef } from '../components'
import { dataEnvelope, toJsonSchema, toParameters } from '../jsonSchema'

const tags = ['Document versions']
const security = [{ serviceRoleKey: [] }]

const DOCUMENT_ID_NOTE =
  'The 19-character id that is also the collaboration room name — never the slug. Resolve a slug once with `GET /api/documents/{docRef}` and keep the id.'

const VERSION_NOTE =
  'Version number, monotonic per document from 1. Bounded by the int4 column, so an out-of-range value is a 400 rather than a database error. Gaps are normal — retention and `DELETE` both leave them.'

const documentIdParam = toParameters(documentIdParamSchema, 'path', {
  documentId: DOCUMENT_ID_NOTE
})

// `versionParamSchema` already carries `documentId`, so `documentIdParam` must
// not be spread beside it — `toParameters` emits one entry per property and the
// pair would be published twice.
const versionParams = toParameters(versionParamSchema, 'path', {
  documentId: DOCUMENT_ID_NOTE,
  version: VERSION_NOTE
})

/** Field-by-field response shapes live in API.md §Document versions; the request
 *  side is generated from the live zod schemas, so it cannot drift from validation. */
const opaqueData = dataEnvelope({ type: 'object', additionalProperties: true })

const okResponse = (description: string): OpenApiResponse => ({
  description,
  content: { 'application/json': { schema: opaqueData } }
})

// Every `zValidator` on these routes passes `houseEnvelopeHook`, so a rejected
// request carries `ErrorEnvelope` — not the raw `ZodValidationError` shape.
const versionErrors = {
  '400': { $ref: '#/components/responses/ValidationError' },
  '401': { $ref: '#/components/responses/Unauthorized' },
  '404': { $ref: '#/components/responses/NotFound' },
  '429': rateLimitedRef,
  '500': { $ref: '#/components/responses/InternalError' }
}

// The shared components describe the content routes: a 5 MiB cap, a slug
// conflict, an encoder rejection. None of the three is true here.
const versionPayloadTooLarge = envelopeResponse(
  'Write body over 16 KiB. These routes carry a name at most — content never rides them.'
)

const headVersionConflict = envelopeResponse(
  'The newest version cannot be deleted; it is the base a cold load reads. Restore an earlier version instead.'
)

const draftDocument = envelopeResponse(
  'Code `DRAFT_DOCUMENT`: the document has never been saved, so there is no history to name or roll back to.'
)

const restoreUnprocessable = envelopeResponse(
  'Code `DRAFT_DOCUMENT` when the document has never been saved, or `UNPROCESSABLE_ENTITY` when the stored snapshot cannot be decoded or re-encoded against the current schema. Nothing is written either way.'
)

const collaborationUnavailable = {
  '503': { $ref: '#/components/responses/ServiceUnavailable' }
}

export const documentVersionsPaths: OpenApiPaths = {
  '/api/documents/{documentId}/versions': {
    get: {
      operationId: 'listDocumentVersions',
      summary: "List a document's versions",
      description:
        'Metadata only, newest first — read snapshot bytes one version at a time. Every debounced save is already a version (10 s idle, 60 s maximum), so rows accumulate whether or not anyone asks for them. `total` counts every row for the document and is read in the same transaction as the page. `since` and `until` bound `createdAt`, not the version number, and both ends are inclusive. Attribution is decoration: when the profile lookup fails, `triggeredBy` falls back to `null` and unresolvable ids drop out of `contributors` rather than failing the request.',
      tags,
      security,
      // `since`/`until` are coerced dates, which zod cannot render as JSON Schema —
      // the emitted schema is empty, so the description is the only type signal.
      parameters: [
        ...documentIdParam,
        ...toParameters(listQuerySchema, 'query', {
          since:
            'Inclusive lower bound on `createdAt`, not on the version number. Any date the runtime can parse.',
          until:
            'Inclusive upper bound on `createdAt`. Independent of `since`; a `since` later than `until` is a 400.'
        })
      ],
      responses: {
        '200': okResponse('One page of version metadata, newest first.'),
        ...versionErrors
      }
    },
    post: {
      operationId: 'checkpointDocumentVersion',
      summary: 'Name the next stored version',
      description:
        'A checkpoint adds a name, not history. The name is what the retention sweep keys off: unnamed rows older than `DOC_AUTOSAVE_RETENTION_DAYS` (default 30) are thinned to one per document per day, while a row named by a person is never pruned. The body is untouched — the checkpoint opens the document, commits an empty transaction to trigger one immediate save, and lets that save carry the name. A checkpoint always lands, even when the bytes have not changed, so naming an unchanged document produces a named row whose content duplicates the row before it. A `200` means the save pipeline was triggered, not that a row exists; poll the list route if you need certainty.',
      tags,
      security,
      parameters: documentIdParam,
      requestBody: {
        required: true,
        description:
          'The name only. Trimmed, 1–200 characters, and the whole body is capped at 16 KiB.',
        content: { 'application/json': { schema: toJsonSchema(checkpointBodySchema) } }
      },
      responses: {
        '200': okResponse('The save pipeline was triggered with this name attached.'),
        '413': versionPayloadTooLarge,
        '422': draftDocument,
        ...versionErrors,
        ...collaborationUnavailable
      }
    }
  },
  '/api/documents/{documentId}/versions/{version}': {
    get: {
      operationId: 'getDocumentVersion',
      summary: "Read one version's content",
      description:
        'Runs through the same decoder as `GET /api/documents/{documentId}/content`. The same trust boundary applies: stored content is returned verbatim and the server never sanitizes it. A `500` here means the stored snapshot could not be decoded.',
      tags,
      security,
      parameters: [...versionParams, ...toParameters(contentQuerySchema, 'query')],
      responses: {
        '200': okResponse("The version's content in the requested format."),
        ...versionErrors
      }
    },
    delete: {
      operationId: 'deleteDocumentVersion',
      summary: 'Delete one version',
      description:
        'Permanent, and it leaves a gap in the numbering. The newest version is refused with `409`: it is the base a cold load reads, so removing it would rewind the document. Checking "is this the head" and deleting happen under one row lock, so the answer cannot go stale between the two. Snapshots are cumulative full state, not deltas, so deleting an old row never damages a newer one.',
      tags,
      security,
      parameters: versionParams,
      responses: {
        '200': okResponse('The version was deleted.'),
        '409': headVersionConflict,
        ...versionErrors
      }
    }
  },
  '/api/documents/{documentId}/versions/{version}/diff': {
    get: {
      operationId: 'diffDocumentVersions',
      summary: 'Compare two versions block by block',
      description:
        '`{version}` is the newer side. `base` defaults to the greatest version below it, which is not always `version - 1`. A `base` at or above `{version}` is a `400`, and that check runs before the document is looked up, so it answers `400` rather than `404` even for a document that does not exist. Comparison is over whole top-level blocks of decoded ProseMirror content, not over words, so a one-word edit reports the paragraph. The diff answers who wrote the text currently in a block; it does not answer who made the change and it does not answer who deleted anything. Neither `503` nor `413` can come back from this route.',
      tags,
      security,
      parameters: [
        ...versionParams,
        ...toParameters(diffQuerySchema, 'query', {
          base: 'The older side. Omitted means the greatest version below `{version}`, which is not always `version - 1`.'
        })
      ],
      responses: {
        '200': okResponse(
          'The changed blocks and the accounts holding live content in them. Both block counts read `0` when the two versions are byte-identical — that means not counted, not empty.'
        ),
        ...versionErrors
      }
    }
  },
  '/api/documents/{documentId}/versions/{version}/restore': {
    post: {
      operationId: 'restoreDocumentVersion',
      summary: "Put a version's content back into the live document",
      description:
        'Not the trash restore — `POST /api/documents/{documentId}/restore` clears `deletedAt` and touches no content. A restore appends two versions and never rewinds the counter: the live document is first captured as a backup named `Before restore of version N`, then the body is replaced. `backupVersion` is `number | null`, and `null` means the reply could not be read, not that no backup was taken. Two `500`s must be told apart by their code: `BACKUP_FAILED` means nothing was restored and the document is unchanged, while the persist-failed `INTERNAL_SERVER_ERROR` means the replacement may already be visible to live collaborators but did not reach the database — verify with a read before retrying, and treat a repeat for the same document as persistence being wedged.',
      tags,
      security,
      parameters: versionParams,
      responses: {
        '200': okResponse('The content was restored, and the backup version it wrote is named.'),
        '413': versionPayloadTooLarge,
        '422': restoreUnprocessable,
        ...versionErrors,
        ...collaborationUnavailable
      }
    }
  }
}
