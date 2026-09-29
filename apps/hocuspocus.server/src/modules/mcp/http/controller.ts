import type { AuthInfo, McpHttpHandler } from '@modelcontextprotocol/server'
import type { Context, Next } from 'hono'

import { fail } from '../../../http/envelope'
import { decodeJwtClaims } from '../../../lib/jwtClaims'
import type { VerifyToken } from '../types'

export const MCP_MOUNT_PATH = '/api/mcp'
export const RESOURCE_METADATA_PATH = '/.well-known/oauth-protected-resource'
// Claude asks for these. ChatGPT still asks for every scope Supabase lists, phone included;
// phone sign-up is off, so no number exists to share. AI apps get name, picture and email.
const SCOPES = ['openid', 'email', 'profile'] as const

export interface EndpointDeps {
  publicBaseUrl: string | null
  authIssuer: string
  allowedOrigins: readonly string[]
  verifyToken: VerifyToken
}

// The configured origin, never a header, when it is set. The local fallback is
// the request origin; a forged Host only misleads the client that forged it.
const resourceUrl = (c: Context, publicBaseUrl: string | null): string =>
  `${(publicBaseUrl ?? new URL(c.req.url).origin).replace(/\/+$/, '')}${MCP_MOUNT_PATH}`

/** RFC 9728. Hosts reach it through the 401 header, since Traefik routes only `/api`. */
export const createMetadataHandler = (deps: EndpointDeps) => (c: Context) =>
  c.json({
    resource: resourceUrl(c, deps.publicBaseUrl),
    authorization_servers: [deps.authIssuer],
    bearer_methods_supported: ['header'],
    resource_name: 'docs.plus',
    scopes_supported: [...SCOPES]
  })

/** MCP transports must refuse a foreign Origin, and Hono's `cors` never refuses. */
export const createOriginGate = (deps: EndpointDeps) => {
  const allowed = new Set(deps.allowedOrigins)
  return async (c: Context, next: Next) => {
    const origin = c.req.header('Origin')
    if (origin && !allowed.has(origin)) return fail(c, 403, 'FORBIDDEN', 'Origin not allowed')
    await next()
  }
}

// Hosts start OAuth only from a 401 that carries this header; a 200 error never does.
const challenge = (
  c: Context,
  publicBaseUrl: string | null,
  message: string,
  errorDescription?: string
): Response => {
  const params = [
    ...(errorDescription
      ? ['error="invalid_token"', `error_description="${errorDescription}"`]
      : []),
    `resource_metadata="${resourceUrl(c, publicBaseUrl)}${RESOURCE_METADATA_PATH}"`,
    `scope="${SCOPES.join(' ')}"`
  ]
  c.header('WWW-Authenticate', `Bearer ${params.join(', ')}`)
  return fail(c, 401, 'UNAUTHORIZED', message)
}

/**
 * Only `Authorization: Bearer`, never the house `token` header. Only a token
 * with `client_id` passes: an OAuth grant mints one, a browser session never does.
 */
export const createAuthenticate =
  (deps: EndpointDeps) =>
  async (c: Context): Promise<AuthInfo | Response> => {
    const header = c.req.header('Authorization')
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : ''
    const deny = (message: string, errorDescription?: string) =>
      challenge(c, deps.publicBaseUrl, message, errorDescription)
    if (!token) return deny('Authentication required')

    const outcome = await deps.verifyToken(token)
    if (outcome.kind === 'unavailable') {
      return fail(c, 503, 'AUTH_UNAVAILABLE', 'Auth service temporarily unavailable')
    }
    if (outcome.kind === 'invalid') {
      return deny('Invalid or expired token', 'The access token is invalid or expired')
    }

    const claims = decodeJwtClaims(token)
    const clientId = claims?.client_id
    if (typeof clientId !== 'string' || clientId.length === 0) {
      return deny(
        'Connect through OAuth',
        'This server accepts only OAuth tokens. Add docs.plus as a connector in your app and sign in there.'
      )
    }
    // The verify cache can outlive the token by up to 60 s; `exp` is exact.
    const expiresAt = typeof claims?.exp === 'number' ? claims.exp : undefined
    if (expiresAt !== undefined && expiresAt * 1000 <= Date.now()) {
      return deny('Invalid or expired token', 'The access token has expired')
    }

    return {
      token,
      clientId,
      scopes: typeof claims?.scope === 'string' ? claims.scope.split(' ').filter(Boolean) : [],
      expiresAt,
      extra: {
        sub: outcome.user.sub,
        email: outcome.user.email,
        isAnonymous: outcome.user.is_anonymous === true
      }
    }
  }

export const createTransportHandler =
  (authenticate: (c: Context) => Promise<AuthInfo | Response>, handler: McpHttpHandler) =>
  async (c: Context): Promise<Response> => {
    const authInfo = await authenticate(c)
    if (authInfo instanceof Response) return authInfo
    return handler.fetch(c.req.raw, { authInfo })
  }
