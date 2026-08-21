import { documentIdParamSchema } from '../../../document-content/http/schema'
import { exportQuerySchema } from '../../../document-conversion/http/schema'
import {
  MAX_IMPORT_BYTES,
  MAX_INFLATED_IMPORT_BYTES,
  MAX_MARKDOWN_CHARS
} from '../../../document-conversion/types'
import type { JsonSchema, OpenApiPaths, SecurityRequirement } from '../../types'
import { envelopeResponse, rateLimitedRef } from '../components'
import { dataEnvelope, toParameters } from '../jsonSchema'

const tags = ['Document content']

/** No anonymous entry: the fallback is `requireUser`, so a tokenless caller is a
 *  401 even on a public document. Access itself is decided per document. */
const security: SecurityRequirement[] = [{ supabaseUserToken: [] }, { serviceRoleKey: [] }]

const documentIdParam = toParameters(documentIdParamSchema, 'path', {
  documentId: 'The 19-character id that is also the collaboration room name — never the slug.'
})

const binary: JsonSchema = { type: 'string', format: 'binary' }

const conversionErrors = {
  '400': { $ref: '#/components/responses/ValidationError' },
  '401': { $ref: '#/components/responses/Unauthorized' },
  '403': { $ref: '#/components/responses/Forbidden' },
  '404': { $ref: '#/components/responses/NotFound' },
  '429': rateLimitedRef,
  '500': { $ref: '#/components/responses/InternalError' },
  '503': { $ref: '#/components/responses/ServiceUnavailable' }
}

const importResult: JsonSchema = {
  type: 'object',
  properties: {
    content: { $ref: '#/components/schemas/TiptapDoc' },
    title: { type: 'string' },
    warnings: {
      type: 'array',
      description: 'Everything the conversion changed or dropped. Empty on a clean import.',
      items: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            enum: [
              'media-placeholder-dropped',
              'title-promoted-paragraph',
              'title-synthesized',
              'unsupported-element'
            ]
          },
          message: { type: 'string' }
        },
        required: ['code', 'message']
      }
    }
  },
  required: ['content', 'title', 'warnings']
}

export const documentConversionPaths: OpenApiPaths = {
  '/api/documents/{documentId}/export': {
    get: {
      operationId: 'exportDocument',
      summary: 'Download a document as a file',
      description:
        "Takes the service-role key or a Supabase user token; the browser sends its access token in the `token` header. A credential is required whatever the document's privacy — a tokenless call is a 401, not an anonymous read. A private document stays owner-only: an anonymous session or an ownerless-private document is a 401, and a signed-in non-owner a 403. Converts the persisted head snapshot, so it trails an actively edited document by the store debounce. A document with metadata but no snapshot exports as an empty file. This response is the raw file, not the house envelope — errors still carry the envelope. Conversion is lossy in named ways: DOCX drops highlights and code-block line breaks, ODT renders images as links, and every format flattens embeds to links. DOCX embeds only images hosted on this API's own media origin — the converter downloads whatever `src` it is handed, so a third-party image is dropped rather than fetched.",
      tags,
      security,
      parameters: [...documentIdParam, ...toParameters(exportQuerySchema, 'query')],
      responses: {
        '200': {
          description: 'The converted file.',
          headers: {
            'Content-Disposition': {
              description:
                '`attachment` with the slugified document title, falling back to the slug and then the id.',
              schema: { type: 'string' }
            }
          },
          content: {
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
              schema: binary
            },
            'application/vnd.oasis.opendocument.text': { schema: binary },
            'text/markdown': { schema: binary }
          }
        },
        ...conversionErrors
      }
    }
  },
  '/api/documents/{documentId}/import': {
    post: {
      operationId: 'importDocument',
      summary: 'Convert an uploaded Word or Markdown file to document content',
      description: `Reads a \`.docx\` or a Markdown file and returns Tiptap JSON. Takes the same credentials as export and gates on write access on top of them: a read-only document refuses everyone but its owner with a 403, since nobody else can apply the result and the conversion costs real CPU. **No database write and no content mutation** — apply the result with \`PATCH /api/documents/{documentId}/content\`, which enforces the read-only lock on the write itself. Markdown carries no \`toc-id\`, so applying it with \`mode=replace\` re-keys every heading and orphans that heading's chat channel, fold state and \`?id=\` links; prefer \`mode=append\`. Both formats arrive as \`multipart/form-data\` — there is no raw-body variant, so one field, one size limit and one sniff cover every upload. The bytes are identified by their container, not their extension or declared MIME type: a zip is \`.docx\`, and anything else must decode as UTF-8 text. Embedded Word images are rehosted through the media route, which is the one side effect: those objects are written to storage even though the document is not. When the server has no public media URL configured each image is reported as a \`media-placeholder-dropped\` warning and the text still imports. Capped at ${MAX_IMPORT_BYTES} bytes uploaded and ${MAX_INFLATED_IMPORT_BYTES} bytes unpacked, and Markdown additionally at ${MAX_MARKDOWN_CHARS} characters.`,
      tags,
      security,
      parameters: documentIdParam,
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            // Hand-written: multipart has no zod schema — the handler reads the
            // form field itself and sniffs the magic bytes.
            schema: {
              type: 'object',
              properties: {
                documentFile: {
                  type: 'string',
                  format: 'binary',
                  description: 'A `.docx` or a Markdown file. The field name is not `file`.'
                }
              },
              required: ['documentFile']
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Converted. Apply `content` yourself; the document is untouched.',
          content: { 'application/json': { schema: dataEnvelope(importResult) } }
        },
        '413': envelopeResponse(
          `The upload exceeds the ${MAX_IMPORT_BYTES}-byte cap, unpacks past ${MAX_INFLATED_IMPORT_BYTES} bytes, or is Markdown longer than ${MAX_MARKDOWN_CHARS} characters — the parser is quadratic, so an oversized body is refused rather than truncated.`
        ),
        '415': envelopeResponse('A legacy OLE2 `.doc`. Re-save it as `.docx`.'),
        '422': envelopeResponse(
          'Neither a zip container nor decodable as UTF-8 text, or a file too damaged for its converter to open.'
        ),
        ...conversionErrors
      }
    }
  }
}
