import type { TMsgRow } from '@types'

import { projectMessageGroups } from './projectMessageGroups'

const m = (
  overrides: Partial<{ id: string; user_id: string; created_at: string; type: string }>
): TMsgRow =>
  ({
    id: overrides.id ?? 'msg',
    user_id: overrides.user_id ?? 'u1',
    created_at: overrides.created_at ?? '2026-05-01T10:00:00.000Z',
    type: overrides.type ?? 'text',
    content: 'hi',
    channel_id: 'c1'
  }) as unknown as TMsgRow

describe('projectMessageGroups', () => {
  it('returns an empty array for empty input', () => {
    expect(projectMessageGroups([], 'me')).toEqual([])
  })

  it('marks a single message as both group start and end', () => {
    const out = projectMessageGroups([m({ id: 'a' })], 'u1')
    expect(out[0]).toMatchObject({ id: 'a', isGroupStart: true, isGroupEnd: true, isOwner: true })
  })

  it('groups consecutive messages from the same user on the same day', () => {
    const out = projectMessageGroups(
      [
        m({ id: 'a', created_at: '2026-05-01T10:00:00Z' }),
        m({ id: 'b', created_at: '2026-05-01T10:00:30Z' }),
        m({ id: 'c', created_at: '2026-05-01T10:01:00Z' })
      ],
      'me'
    )
    expect(out.map((x) => x.isGroupStart)).toEqual([true, false, false])
    expect(out.map((x) => x.isGroupEnd)).toEqual([false, false, true])
  })

  it('breaks the group on user change', () => {
    const out = projectMessageGroups(
      [
        m({ id: 'a', user_id: 'u1', created_at: '2026-05-01T10:00:00Z' }),
        m({ id: 'b', user_id: 'u2', created_at: '2026-05-01T10:00:30Z' })
      ],
      'me'
    )
    expect(out[0].isGroupEnd).toBe(true)
    expect(out[1].isGroupStart).toBe(true)
  })

  it('breaks the group across day boundaries', () => {
    const out = projectMessageGroups(
      [
        m({ id: 'a', user_id: 'u1', created_at: '2026-05-01T23:59:00Z' }),
        m({ id: 'b', user_id: 'u1', created_at: '2026-05-02T00:00:30Z' })
      ],
      'me'
    )
    expect(out[1].isGroupStart).toBe(true)
  })

  it('treats a notification message as a group break for the next row', () => {
    const out = projectMessageGroups(
      [
        m({ id: 'a', user_id: 'u1', type: 'notification' }),
        m({ id: 'b', user_id: 'u1', created_at: '2026-05-01T10:01:00Z' })
      ],
      'me'
    )
    expect(out[1].isGroupStart).toBe(true)
  })

  it('sorts unsorted input by created_at then id', () => {
    const out = projectMessageGroups(
      [
        m({ id: 'b', created_at: '2026-05-01T10:00:30Z' }),
        m({ id: 'a', created_at: '2026-05-01T10:00:00Z' }),
        m({ id: 'c', created_at: '2026-05-01T10:01:00Z' })
      ],
      'me'
    )
    expect(out.map((x) => x.id)).toEqual(['a', 'b', 'c'])
  })

  it('marks isOwner only for the current user', () => {
    const out = projectMessageGroups(
      [m({ id: 'a', user_id: 'me' }), m({ id: 'b', user_id: 'other' })],
      'me'
    )
    expect(out[0].isOwner).toBe(true)
    expect(out[1].isOwner).toBe(false)
  })

  it('produces structurally equal output for identical input', () => {
    const a = m({ id: 'a', created_at: '2026-05-01T10:00:00Z' })
    const b = m({ id: 'b', created_at: '2026-05-01T10:00:30Z' })
    const out1 = projectMessageGroups([a, b], 'me')
    const out2 = projectMessageGroups([a, b], 'me')
    expect(out2[0]).toEqual(out1[0])
    expect(out2[1]).toEqual(out1[1])
  })
})
