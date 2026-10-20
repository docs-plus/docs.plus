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

/** RFC 9728. Served under `/api/mcp`, which the 401 header names, and at the root `.well-known` URLs. */
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

type BearerRefusal = { status: 503 } | { status: 401; message: string; errorDescription?: string }

const INVALID_TOKEN: BearerRefusal = {
  status: 401,
  message: 'Invalid or expired token',
  errorDescription: 'The access token is invalid or expired'
}

/**
 * Only `Authorization: Bearer`, never the house `token` header. Only a token
 * with `client_id` passes: an OAuth grant mints one, a browser session never does.
 * The claim checks run before verify, so a junk token never costs a Supabase call.
 */
const readBearer = async (
  header: string | undefined,
  verifyToken: VerifyToken
): Promise<AuthInfo | BearerRefusal> => {
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return { status: 401, message: 'Authentication required' }

  const claims = decodeJwtClaims(token)
  if (!claims) return INVALID_TOKEN
  const clientId = claims.client_id
  if (typeof clientId !== 'string' || clientId.length === 0) {
    return {
      status: 401,
      message: 'Connect through OAuth',
      errorDescription:
        'This server accepts only OAuth tokens. Add docs.plus as a connector in your app and sign in there.'
    }
  }
  // The verify cache can outlive the token by up to 60 s; `exp` is exact.
  const expiresAt = typeof claims.exp === 'number' ? claims.exp : undefined
  if (expiresAt !== undefined && expiresAt * 1000 <= Date.now()) {
    return {
      status: 401,
      message: 'Invalid or expired token',
      errorDescription: 'The access token has expired'
    }
  }

  const outcome = await verifyToken(token)
  if (outcome.kind === 'unavailable') return { status: 503 }
  if (outcome.kind === 'invalid') return INVALID_TOKEN

  return {
    token,
    clientId,
    scopes: typeof claims.scope === 'string' ? claims.scope.split(' ').filter(Boolean) : [],
    expiresAt,
    extra: {
      sub: outcome.user.sub,
      email: outcome.user.email,
      isAnonymous: outcome.user.is_anonymous === true
    }
  }
}

// One check per request: the rate-limit skip and the transport share it, because
// Supabase Auth's `unavailable` answer is never cached and each call would wait again.
const bearerChecks = new WeakMap<Context, Promise<AuthInfo | BearerRefusal>>()

const checkBearer = (c: Context, verifyToken: VerifyToken): Promise<AuthInfo | BearerRefusal> => {
  let check = bearerChecks.get(c)
  if (!check) {
    check = readBearer(c.req.header('Authorization'), verifyToken)
    bearerChecks.set(c, check)
  }
  return check
}

export const createAuthenticate =
  (deps: EndpointDeps) =>
  async (c: Context): Promise<AuthInfo | Response> => {
    const result = await checkBearer(c, deps.verifyToken)
    if (!('status' in result)) return result
    if (result.status === 503) {
      return fail(c, 503, 'AUTH_UNAVAILABLE', 'Auth service temporarily unavailable')
    }
    return challenge(c, deps.publicBaseUrl, result.message, result.errorDescription)
  }

/**
 * True only for a transport call whose token `createAuthenticate` accepts, so a
 * fake header or a browser session never skips the per-address limit (#551).
 * It verifies only while the address has budget left, so a spent address costs no
 * Supabase call. It never calls `createAuthenticate`, whose header would leak onto a 429.
 */
export const createVerifiedMcpCall =
  (verifyToken: VerifyToken) =>
  async (c: Context, hasBudget: () => Promise<boolean>): Promise<boolean> => {
    if (!['POST', 'GET', 'DELETE'].includes(c.req.method)) return false
    if (new URL(c.req.url).pathname !== MCP_MOUNT_PATH) return false
    if (!c.req.header('Authorization')?.startsWith('Bearer ')) return false
    if (!(await hasBudget())) return false
    try {
      return !('status' in (await checkBearer(c, verifyToken)))
    } catch {
      return false
    }
  }

export const createTransportHandler =
  (authenticate: (c: Context) => Promise<AuthInfo | Response>, handler: McpHttpHandler) =>
  async (c: Context): Promise<Response> => {
    const authInfo = await authenticate(c)
    if (authInfo instanceof Response) return authInfo
    return handler.fetch(c.req.raw, { authInfo })
  }
