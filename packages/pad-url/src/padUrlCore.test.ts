import { describe, expect, it } from 'bun:test'

import type { PadUrlContext } from './types'
import { padUrlCore } from './padUrlCore'

const ORIGIN = 'https://app.test'
const TRAILS: Record<string, string> = { 'h-setup': 'methods>setup' }

const ctx = (live: string, trailOf = (id: string) => TRAILS[id] ?? null): PadUrlContext => ({
  origin: ORIGIN,
  live: `${ORIGIN}${live}`,
  trailOf
})

const plan = (live: string, change: Parameters<typeof padUrlCore.plan>[0]) =>
  padUrlCore.plan(change, ctx(live))

describe('padUrlCore.format', () => {
  it('builds a heading link from the pad base, with no live filter, chat or hash', () => {
    const live = ctx('/doc/apple?chatroom=c1&mode=and#history')
    expect(padUrlCore.format({ kind: 'heading', headingId: 'h-setup' }, live)).toBe(
      `${ORIGIN}/doc?h=methods%3Esetup&id=h-setup`
    )
  })

  it('writes id only when there is no trail', () => {
    expect(padUrlCore.format({ kind: 'heading', headingId: 'x' }, ctx('/doc'))).toBe(
      `${ORIGIN}/doc?id=x`
    )
  })

  it('writes chatroom before msg_id, and a root-relative form for stored links', () => {
    const live = ctx('/doc/apple?h=a&id=b')
    expect(padUrlCore.format({ kind: 'chat', linkId: 'c1', messageId: 'm1' }, live)).toBe(
      `${ORIGIN}/doc?chatroom=c1&msg_id=m1`
    )
    expect(padUrlCore.format({ kind: 'chat', linkId: 'c1' }, live, 'path')).toBe('/doc?chatroom=c1')
  })

  it('takes an explicit document slug', () => {
    expect(padUrlCore.format({ kind: 'document', slug: 'other' }, ctx('/doc'))).toBe(
      `${ORIGIN}/other`
    )
  })
})

describe('padUrlCore.plan', () => {
  it('moves a heading in place: live state kept, id last, raw writer', () => {
    expect(
      plan('/doc/abc?id=old&chatroom=c1&h=old#x', { kind: 'heading', headingId: 'h-setup' })
    ).toEqual({ to: '/doc/abc?chatroom=c1&h=methods%3Esetup&id=h-setup#x', writer: 'keepState' })
    expect(plan('/doc', { kind: 'heading', headingId: 'h-setup', entry: 'push' })?.writer).toBe(
      'pushBlank'
    )
  })

  it('builds a Focus section path with no chat, mode, trail or hash state', () => {
    expect(
      plan('/doc/x?chatroom=c&msg_id=d&mode=and&h=a&id=b#history', {
        kind: 'focus',
        headingId: 'y',
        term: 'New  Term'
      })
    ).toEqual({ to: '/doc/new-term?id=y', writer: 'routerPush' })
  })

  it('adds a term in the current form and skips a folded duplicate', () => {
    expect(plan('/doc', { kind: 'filterAdd', term: 'Apple  Pie' })?.to).toBe('/doc/apple-pie')
    expect(plan('/doc', { kind: 'filterAdd', term: 'C++' })?.to).toBe('/doc/c%2B%2B')
    expect(plan('/doc?h=a&id=b', { kind: 'filterAdd', term: 'x' })?.to).toBe('/doc/x?h=a&id=b')
    expect(plan('/doc/apple-pie', { kind: 'filterAdd', term: 'apple pie' })).toBeNull()
    expect(plan('/doc', { kind: 'filterAdd', term: '   ' })).toBeNull()
  })

  it('rewrites an old %20 path in the current form on any filter write', () => {
    expect(plan('/doc/Apple%20Pie', { kind: 'filterAdd', term: 'carrot' })?.to).toBe(
      '/doc/apple-pie/carrot'
    )
    expect(plan('/doc/Apple%20Pie/carrot', { kind: 'filterRemove', term: 'carrot' })?.to).toBe(
      '/doc/apple-pie'
    )
  })

  it('removes by the fold, and drops mode with the last term', () => {
    expect(plan('/doc/apple-pie/carrot', { kind: 'filterRemove', term: 'apple pie' })?.to).toBe(
      '/doc/carrot'
    )
    expect(plan('/doc/apple?mode=and', { kind: 'filterRemove', term: 'Apple' })?.to).toBe('/doc')
  })

  it('toggles mode, and resets terms and mode while keeping the hash', () => {
    expect(plan('/doc/apple', { kind: 'filterMode', mode: 'and' })?.to).toBe('/doc/apple?mode=and')
    expect(plan('/doc/apple?mode=and#history', { kind: 'filterMode', mode: 'or' })?.to).toBe(
      '/doc/apple#history'
    )
    expect(plan('/doc/apple/carrot?mode=and#history', { kind: 'filterReset' })?.to).toBe(
      '/doc#history'
    )
  })

  it('opens a stored filter link clean, keeping the reader mode when it names none', () => {
    expect(
      plan('/doc?mode=and', { kind: 'filterOpen', href: `${ORIGIN}/doc/Draw%20a%20diagram?id=h1` })
    ).toEqual({ to: '/doc/draw-a-diagram?id=h1&mode=and', writer: 'routerPush' })
  })

  it('strips chat on close, and the heading only when it names the closed room', () => {
    expect(
      plan('/doc?h=t&id=room&chatroom=room&msg_id=m', { kind: 'chatClosed', headingId: 'room' })
    ).toEqual({ to: '/doc', writer: 'routerReplace' })
    expect(
      plan('/doc?h=t&id=other&chatroom=room', { kind: 'chatClosed', headingId: 'room' })?.to
    ).toBe('/doc?h=t&id=other')
    expect(plan('/doc?act=ch&c_id=c&m_id=m', { kind: 'chatClosed', headingId: null })?.to).toBe(
      '/doc'
    )
    expect(plan('/doc?h=t&id=x', { kind: 'chatClosed', headingId: 'room' })).toBeNull()
  })

  it('writes nothing off a pad', () => {
    expect(plan('/', { kind: 'filterReset' })).toBeNull()
  })
})

describe('padUrlCore.parse', () => {
  it('decodes old and new terms once, and keeps a malformed one raw', () => {
    expect(
      padUrlCore.parse('/doc/Draw%20a%20diagram/draw-a-diagram/c%2B%2B/100%25/%E0?id=x', ORIGIN)
        ?.terms
    ).toEqual(['Draw a diagram', 'draw-a-diagram', 'c++', '100%', '%E0'])
  })

  it('reads the canonical, legacy and sign-in chat forms', () => {
    expect(padUrlCore.parse('/doc?chatroom=c&msg_id=m', ORIGIN)?.chat).toEqual({
      linkId: 'c',
      messageId: 'm'
    })
    expect(padUrlCore.parse('/doc?act=ch&c_id=c&m_id=m', ORIGIN)?.chat).toEqual({
      linkId: 'c',
      messageId: 'm'
    })
    expect(padUrlCore.parse('/doc?chatroom=new&act=ch&c_id=old', ORIGIN)?.chat?.linkId).toBe('new')
    expect(padUrlCore.parse('/doc?open_heading_chat=h', ORIGIN)?.signInChat).toBe('h')
  })

  it('reads the heading id, mode, slug and origin, and never throws', () => {
    const pad = padUrlCore.parse(`${ORIGIN}/doc/a?h=x_y&id=h1&mode=and#history`, ORIGIN)
    expect(pad).toMatchObject({ slug: 'doc', headingId: 'h1', mode: 'and', hash: '#history' })
    expect(padUrlCore.parse('https://other.test/doc', ORIGIN)?.sameOrigin).toBe(false)
    expect(padUrlCore.parse('http://[', ORIGIN)).toBeNull()
  })
})

describe('padUrlCore.readable', () => {
  it('shows the > trail and keeps every escape that would end or split a pasted link', () => {
    expect(padUrlCore.readable(`${ORIGIN}/doc?h=a%3Eb%3ec&id=x`)).toBe(`${ORIGIN}/doc?h=a>b>c&id=x`)
    expect(padUrlCore.readable(`${ORIGIN}/doc/a%20b?q=%26%3D%23`)).toBe(
      `${ORIGIN}/doc/a%20b?q=%26%3D%23`
    )
  })
})
