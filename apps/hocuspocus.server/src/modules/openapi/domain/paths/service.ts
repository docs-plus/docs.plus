import type { OpenApiPaths } from '../../types'
import { rateLimitedRef } from '../components'

export const servicePaths: OpenApiPaths = {
  '/': {
    get: {
      operationId: 'getRoot',
      summary: 'Liveness ping',
      tags: ['Service'],
      security: [{}],
      responses: {
        '200': {
          description: 'Static greeting.',
          content: {
            'application/json': {
              schema: { type: 'object', properties: { message: { type: 'string' } } }
            }
          }
        },
        '429': rateLimitedRef
      }
    }
  },
  '/metrics': {
    get: {
      operationId: 'getMetrics',
      summary: 'Prometheus exposition',
      description:
        'Internal only — Traefik routes just `/api` and `/health`, so this is unreachable from the public edge.',
      tags: ['Service'],
      security: [{}],
      responses: {
        '200': {
          description: 'Prometheus text format.',
          content: { 'text/plain': { schema: { type: 'string' } } }
        },
        '429': rateLimitedRef
      }
    }
  },
  '/openapi.json': {
    get: {
      operationId: 'getOpenApiDocument',
      summary: 'This document',
      tags: ['Service'],
      security: [{}],
      responses: {
        '200': {
          description: 'The OpenAPI 3.1 document.',
          content: { 'application/json': { schema: { type: 'object' } } }
        },
        '429': rateLimitedRef
      }
    }
  },
  '/docs': {
    get: {
      operationId: 'getSwaggerUi',
      summary: 'Swagger UI',
      description:
        'Renders this document. Assets load from a pinned CDN with subresource integrity.',
      tags: ['Service'],
      security: [{}],
      responses: {
        '200': {
          description: 'The Swagger UI page.',
          content: { 'text/html': { schema: { type: 'string' } } }
        },
        '429': rateLimitedRef
      }
    }
  }
}
