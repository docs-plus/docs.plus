import { type AuthInfo, isJsonContentType, type McpHttpHandler } from '@modelcontextprotocol/server'
import type { Context, Next } from 'hono'

import { fail } from '../../../http/envelope'
import { isRecord } from '../../../lib/isRecord'
import { decodeJwtClaims } from '../../../lib/jwtClaims'
import { type McpRateLimitDecision, setRateLimitHeaders } from '../../../middleware'
import { MCP_REQUESTS_PER_MINUTE } from '../infra/toolBudget'
import type { Caller, CallerBudget, VerifyToken } from '../types'

export const MCP_MOUNT_PATH = '/api/mcp'
export const RESOURCE_METADATA_PATH = '/.well-known/oauth-protected-resource'
// Claude asks for these. ChatGPT still asks for every scope Supabase lists, phone included;
// phone sign-up is off, so no number exists to share. AI apps get name, picture and email.
const SCOPES = ['openid', 'email', 'profile'] as const

/** The transport's methods. The rate-limit skip and the router both read this list. */
export const MCP_METHODS = ['POST', 'GET', 'DELETE']

export interface EndpointDeps {
  publicBaseUrl: string | null
  authIssuer: string
  allowedOrigins: readonly string[]
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

const extractBearerToken = (header: string | undefined): string => {
  const match = header?.trim().match(/^bearer\s+(\S.*)$/i)
  return match?.[1] ?? ''
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
  const token = extractBearerToken(header)
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

// `readBearer` built this `extra`. A missing subject is a wiring fault, so it fails
// loudly rather than running a request as nobody.
export const callerFrom = (authInfo: AuthInfo | undefined): Caller => {
  const sub = authInfo?.extra?.sub
  if (!authInfo || typeof sub !== 'string')
    throw new Error('MCP request reached tools unauthenticated')
  const email = authInfo.extra?.email
  return {
    sub,
    email: typeof email === 'string' ? email : undefined,
    isAnonymous: authInfo.extra?.isAnonymous === true,
    clientId: authInfo.clientId
  }
}

export type BearerCheck = (c: Context) => Promise<AuthInfo | BearerRefusal>

/**
 * One check per request: the rate-limit skip and the transport share it, because
 * Supabase Auth's `unavailable` answer is never cached and each call would wait again.
 */
export const createBearerCheck = (verifyToken: VerifyToken): BearerCheck => {
  const checks = new WeakMap<Context, Promise<AuthInfo | BearerRefusal>>()
  return (c) => {
    let check = checks.get(c)
    if (!check) {
      check = readBearer(c.req.header('Authorization'), verifyToken)
      checks.set(c, check)
    }
    return check
  }
}

export const createAuthenticate =
  (publicBaseUrl: string | null, checkBearer: BearerCheck) =>
  async (c: Context): Promise<AuthInfo | Response> => {
    const result = await checkBearer(c)
    if (!('status' in result)) return result
    if (result.status === 503) {
      return fail(c, 503, 'AUTH_UNAVAILABLE', 'Auth service temporarily unavailable')
    }
    return challenge(c, publicBaseUrl, result.message, result.errorDescription)
  }

export type McpRateLimit = (
  c: Context,
  hasGlobalBudget: () => Promise<boolean>,
  path?: string
) => Promise<McpRateLimitDecision>

/**
 * Evaluates `/api/mcp` transport calls ahead of the Origin gate and body limit.
 * Reads `hasGlobalBudget` first so a spent address never calls Supabase Auth.
 * Charges `requestBudget(sub)` once; Auth `503` returns `auth-unavailable`.
 */
export const createMcpRateLimit =
  (checkBearer: BearerCheck, requestBudget: CallerBudget): McpRateLimit =>
  async (c, hasGlobalBudget, path) => {
    if (!MCP_METHODS.includes(c.req.method)) return { kind: 'fallthrough' }
    const pathname = path ?? new URL(c.req.url).pathname
    if (pathname !== MCP_MOUNT_PATH) return { kind: 'fallthrough' }
    if (!extractBearerToken(c.req.header('Authorization'))) return { kind: 'fallthrough' }
    if (!(await hasGlobalBudget())) return { kind: 'fallthrough' }
    const result = await checkBearer(c)
    if ('status' in result) {
      return result.status === 503 ? { kind: 'auth-unavailable' } : { kind: 'fallthrough' }
    }
    const budget = await requestBudget(callerFrom(result).sub)
    if (!budget.ok) {
      setRateLimitHeaders(c, {
        limit: budget.limit ?? MCP_REQUESTS_PER_MINUTE,
        remaining: 0,
        resetMs: budget.msBeforeNext ?? budget.retryAfter * 1000,
        retryAfter: budget.retryAfter
      })
      return {
        kind: 'limited',
        response: fail(c, 429, 'RATE_LIMIT_EXCEEDED', 'Too many requests, please try again later')
      }
    }
    return { kind: 'verified' }
  }

/**
 * Authenticates `/api/mcp` requests and validates JSON-RPC `POST` bodies before SDK dispatch.
 * `GET` and `DELETE` bypass body checks so the SDK returns `405`.
 */
export const createTransportHandler =
  (
    authenticate: (c: Context) => Promise<AuthInfo | Response>,
    handler: Pick<McpHttpHandler, 'fetch'>
  ) =>
  async (c: Context): Promise<Response> => {
    const authInfo = await authenticate(c)
    if (authInfo instanceof Response) return authInfo

    if (c.req.method !== 'POST') {
      return handler.fetch(c.req.raw, { authInfo })
    }

    if (!isJsonContentType(c.req.header('content-type'))) {
      return c.json(
        {
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Unsupported Media Type: Content-Type must be application/json'
          },
          id: null
        },
        415
      )
    }

    let parsed: unknown
    try {
      const text = await c.req.text()
      parsed = JSON.parse(text)
    } catch {
      return c.json(
        {
          jsonrpc: '2.0',
          error: { code: -32700, message: 'Parse error: Invalid JSON' },
          id: null
        },
        400
      )
    }

    if (Array.isArray(parsed)) {
      return c.json(
        {
          jsonrpc: '2.0',
          error: { code: -32600, message: 'JSON-RPC batch requests are not supported' },
          id: null
        },
        400
      )
    }

    if (isRecord(parsed) && parsed.method === 'subscriptions/listen') {
      const id = typeof parsed.id === 'string' || typeof parsed.id === 'number' ? parsed.id : null
      return c.json(
        {
          jsonrpc: '2.0',
          error: { code: -32601, message: 'Method not found' },
          id
        },
        404
      )
    }

    return handler.fetch(c.req.raw, { authInfo, parsedBody: parsed })
  }
