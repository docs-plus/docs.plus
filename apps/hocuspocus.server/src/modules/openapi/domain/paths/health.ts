import type { OpenApiOperation, OpenApiPaths } from '../../types'

/** Health is the one group exempt from the global limiter, so no 429 here. */
const probe = (operationId: string, summary: string, description: string): OpenApiOperation => ({
  operationId,
  summary,
  description,
  tags: ['Health'],
  security: [{}],
  responses: {
    '200': {
      description: 'Service is healthy.',
      content: {
        'application/json': { schema: { $ref: '#/components/schemas/HealthCheckResult' } }
      }
    },
    '503': {
      description: 'Service is unhealthy.',
      content: {
        'application/json': { schema: { $ref: '#/components/schemas/HealthCheckResult' } }
      }
    }
  }
})

export const healthPaths: OpenApiPaths = {
  '/health': {
    get: {
      operationId: 'getHealth',
      summary: 'Aggregate health check',
      description:
        'Database, Redis and Supabase. Reports `degraded` (503) only when a critical service is unhealthy — Supabase may be down without failing the overall check.',
      tags: ['Health'],
      security: [{}],
      responses: {
        '200': {
          description: 'All critical services healthy.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/OverallHealth' } }
          }
        },
        '503': {
          description: 'A critical service is unhealthy.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/OverallHealth' } }
          }
        }
      }
    }
  },
  '/health/database': {
    get: probe(
      'getHealthDatabase',
      'Database health',
      'Connectivity (`SELECT 1`) plus pool metadata.'
    )
  },
  '/health/redis': {
    get: probe(
      'getHealthRedis',
      'Redis health',
      '`PING`. Reports `disabled` when Redis is not configured.'
    )
  },
  '/health/supabase': {
    get: probe(
      'getHealthSupabase',
      'Supabase health',
      'Reachability. Reports `disabled` when `SUPABASE_URL` / `SUPABASE_ANON_KEY` are unset.'
    )
  },
  '/health/push': {
    get: {
      operationId: 'getHealthPush',
      summary: 'Push gateway health',
      description:
        'The only HTTP surface push has. Delivery runs through pgmq and devices register through the `register_push_subscription` / `unregister_push_subscription` Supabase RPCs — see the Push tag.',
      tags: ['Health', 'Push'],
      security: [{}],
      responses: {
        '200': {
          description: 'VAPID configured and queue connected.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/PushHealth' } } }
        },
        '503': {
          description: 'VAPID unconfigured or queue disconnected.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/PushHealth' } } }
        }
      }
    }
  }
}
