import { afterAll, beforeAll, describe, expect, test, mock } from 'bun:test'

import * as realUtils from '../../src/api/utils/supabase'
import * as realSupabase from '../../src/lib/supabase'

const ADMIN_ID = 'admin-1'

// Unsigned: the stubbed getUser stands in for Supabase's signature check.
const CONNECTED_APP_TOKEN = `e30.${Buffer.from(
  JSON.stringify({ sub: ADMIN_ID, client_id: 'app' })
).toString('base64url')}.sig`

// Other test files map these tokens too. bun test shares one process and one
// token cache, so a shared token must map to the same user id in every file.
const USERS: Record<string, string> = {
  'valid-test-token': 'user-123',
  'other-user-token': 'user-456',
  'admin-token': ADMIN_ID,
  // An admin, so only the client_id check can refuse it.
  [CONNECTED_APP_TOKEN]: ADMIN_ID
}

// Null outside this file, so the mock left behind matches documents.test.ts.
let serviceRoleClient: unknown = null

const adminUsersStub = {
  from: (table: string) => {
    let userId: unknown
    const query = {
      select: () => query,
      eq: (_column: string, value: unknown) => {
        userId = value
        return query
      },
      maybeSingle: async () => ({
        data: table === 'admin_users' && userId === ADMIN_ID ? { user_id: ADMIN_ID } : null,
        error: null
      })
    }
    return query
  }
}

const mockedSupabase = () => ({
  ...realSupabase,
  getAnonClient: () => ({
    auth: {
      getUser: async (token: string) => {
        const id = USERS[token]
        if (id) {
          return {
            data: {
              user: { id, email: `${id}@example.com`, is_anonymous: false, user_metadata: {} }
            },
            error: null
          }
        }
        return { data: { user: null }, error: { status: 401, message: 'invalid' } }
      }
    }
  }),
  getServiceRoleClient: () => serviceRoleClient
})

// Do NOT mock `lib/auth`: the real guard must verify the token.
mock.module('../../src/lib/supabase', mockedSupabase)
// `getSupabaseClient` is a copy of `getServiceRoleClient` taken at first import,
// so an earlier suite can pin it. Point it back at this file's stub.
const realGetSupabaseClient = realUtils.getSupabaseClient
mock.module('../../src/api/utils/supabase', () => ({
  ...realUtils,
  getSupabaseClient: () => serviceRoleClient ?? realGetSupabaseClient()
}))

import { Hono } from 'hono'

import adminRouter from '../../src/api/routers/admin.router'
import { createMockPrisma, TestServer } from '../helpers/test-server'

// A dropped `admin.use('*', adminAuthMiddleware)` lets anyone delete users.
describe('admin guard', () => {
  let server: TestServer

  beforeAll(() => {
    serviceRoleClient = adminUsersStub
    const app = new Hono()
    app.use('*', async (c, next) => {
      c.set('prisma', createMockPrisma() as never)
      await next()
    })
    app.route('/api/admin', adminRouter)
    server = new TestServer(app)
  })

  afterAll(() => {
    serviceRoleClient = null
  })

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

  test('no Authorization header gets 401', async () => {
    const response = await server.get('/api/admin/stats')
    expect(response.status).toBe(401)
    expect((await response.json()).error).toBe('Authorization header required')
  })

  test('a signed-in non-admin gets 403', async () => {
    const response = await server.get('/api/admin/stats', bearer('valid-test-token'))
    expect(response.status).toBe(403)
    expect((await response.json()).error).toBe('Admin access required')
  })

  test("an admin's connected-app token gets 403", async () => {
    const response = await server.get('/api/admin/stats', bearer(CONNECTED_APP_TOKEN))
    expect(response.status).toBe(403)
    expect((await response.json()).error).toBe('Connected apps cannot use admin routes')
  })

  test('an admin gets 200', async () => {
    const response = await server.get('/api/admin/stats', bearer('admin-token'))
    expect(response.status).toBe(200)
    expect((await response.json()).documents).toHaveProperty('total', 0)
  })
})
