import { describe, expect, mock, test } from 'bun:test'

// Mock the anon Supabase client before importing auth so getUser returns a
// controllable shape. verifySupabaseToken's transient-vs-definitive branching
// is a contract-bearing decision (transient → throw, definitive → null) that
// three callers depend on, so pin it directly.
let getUserResult: { data: { user: unknown }; error: unknown } = {
  data: { user: null },
  error: null
}
const getUser = mock(async (_token: string) => getUserResult)
mock.module('../supabase', () => ({
  getAnonClient: () => ({ auth: { getUser } })
}))

const { verifySupabaseToken, TransientAuthError } = await import('../auth')

describe('verifySupabaseToken', () => {
  test('returns the user on success', async () => {
    getUserResult = { data: { user: { id: 'u1', email: 'a@b.c' } }, error: null }
    const user = await verifySupabaseToken('tok-success')
    expect(user?.sub).toBe('u1')
  })

  test('returns null for a definitively-invalid token (4xx)', async () => {
    getUserResult = { data: { user: null }, error: { status: 401, message: 'bad jwt' } }
    const user = await verifySupabaseToken('tok-definitive-401')
    expect(user).toBeNull()
  })

  test('throws TransientAuthError on a 5xx auth-backend failure', async () => {
    getUserResult = { data: { user: null }, error: { status: 503, message: 'upstream down' } }
    await expect(verifySupabaseToken('tok-transient-5xx')).rejects.toBeInstanceOf(
      TransientAuthError
    )
  })

  test('throws TransientAuthError when the error carries no status (network)', async () => {
    getUserResult = { data: { user: null }, error: { message: 'network' } }
    await expect(verifySupabaseToken('tok-transient-nostatus')).rejects.toBeInstanceOf(
      TransientAuthError
    )
  })

  test('throws TransientAuthError on a 429 rate-limit', async () => {
    getUserResult = { data: { user: null }, error: { status: 429, message: 'slow down' } }
    await expect(verifySupabaseToken('tok-transient-429')).rejects.toBeInstanceOf(
      TransientAuthError
    )
  })

  test('negative-caches a definitively-invalid token (second call is not re-verified)', async () => {
    getUserResult = { data: { user: null }, error: { status: 401, message: 'bad jwt' } }
    getUser.mockClear()
    expect(await verifySupabaseToken('tok-neg-cache')).toBeNull()
    expect(await verifySupabaseToken('tok-neg-cache')).toBeNull()
    expect(getUser.mock.calls.length).toBe(1)
  })

  test('does not cache a transient failure (a later valid result is honored)', async () => {
    getUserResult = { data: { user: null }, error: { status: 503, message: 'upstream down' } }
    await expect(verifySupabaseToken('tok-flip')).rejects.toBeInstanceOf(TransientAuthError)
    getUserResult = { data: { user: { id: 'u-flip', email: 'f@x.c' } }, error: null }
    const user = await verifySupabaseToken('tok-flip')
    expect(user?.sub).toBe('u-flip')
  })
})
