import type { Hocuspocus } from '@hocuspocus/server'
import { describe, expect, test } from 'bun:test'

import { buildHealthReport, countActiveConnections } from '../health'

// Rooms holding the given connection counts. The report reads nothing else off
// the instance.
const instanceWith = (perRoom: number[]): Hocuspocus =>
  ({
    documents: new Map(
      perRoom.map((count, index) => [`doc-${index}`, { getConnectionsCount: () => count }])
    )
  }) as unknown as Hocuspocus

// The connection sum gates two Grafana alerts, and API.md publishes the payload
// shapes. No probe consumer parses the words, so only this pins a silent change.
describe('health probe payloads', () => {
  test('sums the connections of every room', () => {
    expect(countActiveConnections(instanceWith([2, 1, 0]))).toBe(3)
    expect(countActiveConnections(instanceWith([5]))).toBe(5)
    expect(countActiveConnections(instanceWith([]))).toBe(0)
  })

  test('serialises a replica with Redis sync wired', () => {
    const report = buildHealthReport(instanceWith([3, 1]), true)

    expect(JSON.parse(JSON.stringify(report))).toEqual({
      status: 'ok',
      timestamp: expect.any(String),
      services: {
        websocket: { status: 'healthy', connections: 4, lastCheck: expect.any(String) },
        database: { status: 'configured', lastCheck: expect.any(String) },
        redis: { status: 'configured', lastCheck: expect.any(String) }
      }
    })
  })

  // The Database extension is pushed unconditionally, so the database subject
  // reads 'configured' even here. Only Redis sync has an absent arm.
  test('calls an absent Redis sync disabled and still reports the database', () => {
    const report = buildHealthReport(instanceWith([]), false)

    expect(JSON.parse(JSON.stringify(report.services.redis))).toEqual({ status: 'disabled' })
    expect(JSON.parse(JSON.stringify(report.services.database))).toEqual({
      status: 'configured',
      lastCheck: expect.any(String)
    })
  })
})
