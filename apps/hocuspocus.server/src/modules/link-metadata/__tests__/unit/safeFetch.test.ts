import * as dns from 'node:dns/promises'

import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'

import { safeFetch } from '../../domain/ssrf'

// The handler tests stub DNS to a public address. These cases check the
// redirect-hop and lookup refusals in safeFetch itself.
describe('safeFetch', () => {
  let fetchSpy: ReturnType<typeof spyOn>
  let dnsSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    // Answer every fetch with a fresh redirect, so a removed guard never dials out.
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
      (async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'http://169.254.169.254/latest/meta-data' }
        })) as never
    )
    dnsSpy = spyOn(dns, 'lookup')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
    dnsSpy.mockRestore()
  })

  test('refuses a redirect to a link-local address after one fetch', async () => {
    dnsSpy.mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never)

    await expect(safeFetch('https://example.com/a', {})).rejects.toThrow(/unsafe redirect target/)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect((fetchSpy.mock.calls[0][1] as RequestInit).redirect).toBe('manual')
  })

  test('refuses a host that resolves to a private address, before any fetch', async () => {
    dnsSpy.mockResolvedValue([{ address: '10.0.0.5', family: 4 }] as never)

    await expect(safeFetch('https://example.com/a', {})).rejects.toThrow(
      /did not resolve to a public address/
    )
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test('refuses a host whose lookup fails, before any fetch', async () => {
    dnsSpy.mockRejectedValue(
      Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' })
    )

    await expect(safeFetch('https://example.com/a', {})).rejects.toThrow(
      /did not resolve to a public address/
    )
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
