/**
 * A small in-memory stand-in for Supabase Auth and one PostgREST table, so the
 * signed-in E2E branches run in CI without a real Supabase. It checks a token by
 * lookup, not by signature. Every other path answers 404, which callers treat as
 * a soft failure. `bun scripts/lib/supabaseStub.ts` listens on the SUPABASE_URL port.
 */

interface StubUser {
  id: string
  aud: 'authenticated'
  role: 'authenticated'
  email: string
  email_confirmed_at: string
  user_metadata: Record<string, unknown>
  app_metadata: { provider: 'email' }
  is_anonymous: false
  created_at: string
}

const users = new Map<string, StubUser>()
const passwords = new Map<string, string>()
const tokens = new Map<string, StubUser>()
const loggedMisses = new Set<string>()

const json = (body: unknown, status = 200): Response => Response.json(body, { status })

const base64url = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url')

// JWT-shaped because WS admission decodes `exp` (in seconds) before it trusts a token.
const mintSession = (user: StubUser) => {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600
  const payload = { sub: user.id, role: 'authenticated', aud: 'authenticated', exp: expiresAt }
  const accessToken = `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url(payload)}.${crypto.randomUUID()}`
  tokens.set(accessToken, user)
  return {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expiresAt,
    refresh_token: crypto.randomUUID(),
    user
  }
}

const createUser = async (request: Request): Promise<Response> => {
  const { email, password, user_metadata } = (await request.json()) as {
    email: string
    password: string
    user_metadata?: Record<string, unknown>
  }
  if (users.has(email)) return json({ code: 422, error_code: 'email_exists' }, 422)
  const now = new Date().toISOString()
  const user: StubUser = {
    id: crypto.randomUUID(),
    aud: 'authenticated',
    role: 'authenticated',
    email,
    email_confirmed_at: now,
    user_metadata: user_metadata ?? {},
    app_metadata: { provider: 'email' },
    is_anonymous: false,
    created_at: now
  }
  users.set(email, user)
  passwords.set(email, password)
  return json(user)
}

const passwordGrant = async (request: Request): Promise<Response> => {
  const { email, password } = (await request.json()) as { email: string; password: string }
  const user = users.get(email)
  if (!user || passwords.get(email) !== password) {
    return json({ code: 400, error_code: 'invalid_credentials' }, 400)
  }
  return json(mintSession(user))
}

// 401, never 5xx: src/lib/auth.ts maps a 5xx to `unavailable`, not `invalid`.
const currentUser = (request: Request): Response => {
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '') ?? ''
  const user = tokens.get(token)
  return user ? json(user) : json({ code: 401, error_code: 'bad_jwt' }, 401)
}

// Always an array: postgrest-js reduces it for maybeSingle. No filter serves the health probe.
const userRows = (url: URL): Response => {
  const filter = url.searchParams.get('id') ?? ''
  const ids = filter.startsWith('in.(')
    ? filter.slice(4, -1).replaceAll('"', '').split(',')
    : filter.startsWith('eq.')
      ? [filter.slice(3)]
      : null
  const rows = [...users.values()]
    .filter((user) => ids === null || ids.includes(user.id))
    .map((user) => ({
      id: user.id,
      avatar_url: null,
      avatar_updated_at: null,
      full_name: (user.user_metadata.full_name as string | undefined) ?? null,
      display_name: null
    }))
  return json(rows)
}

const handleStubRequest = async (request: Request): Promise<Response> => {
  const url = new URL(request.url)
  const route = `${request.method} ${url.pathname}`
  if (route === 'POST /auth/v1/admin/users') return createUser(request)
  if (route === 'POST /auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
    return passwordGrant(request)
  }
  if (route === 'GET /auth/v1/user') return currentUser(request)
  if (route === 'GET /rest/v1/users') return userRows(url)
  // Every run's cleanup deletes its users. The id is in the path, so a miss
  // would log once per user and bury a real miss.
  if (request.method === 'DELETE' && url.pathname.startsWith('/auth/v1/admin/users/')) {
    return json({})
  }

  // An object, not an array: postgrest-js reads a 404 array body as an empty success.
  if (!loggedMisses.has(route)) {
    loggedMisses.add(route)
    console.error(`supabase stub: 404 ${route}`)
  }
  return json(
    { code: 'stub_not_found', error_code: 'not_found', message: `stub has no ${route}` },
    404
  )
}

const server = Bun.serve({
  hostname: '127.0.0.1',
  port: Number(new URL(process.env.SUPABASE_URL ?? 'http://127.0.0.1:54399').port),
  fetch: handleStubRequest
})
console.log(`supabase stub listening on ${server.url}`)
