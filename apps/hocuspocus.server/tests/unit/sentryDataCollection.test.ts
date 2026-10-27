import { describe, expect, test } from 'bun:test'

import { originOnlyBreadcrumb } from '../../src/lib/sentryDataCollection'

describe('originOnlyBreadcrumb', () => {
  test('an outgoing fetch keeps the origin, never the path or query', () => {
    const crumb = originOnlyBreadcrumb({
      category: 'fetch',
      data: { url: 'https://example.com/reset?token=secret', method: 'GET', status_code: 200 }
    })
    expect(crumb.data).toEqual({ url: 'https://example.com', method: 'GET', status_code: 200 })
  })

  test('other breadcrumbs pass through unchanged', () => {
    const crumb = { category: 'console', message: 'hello' }
    expect(originOnlyBreadcrumb({ ...crumb })).toEqual(crumb)
  })
})
