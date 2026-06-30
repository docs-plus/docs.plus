/// <reference types="jest" />

import { classifyInternalDocumentLink } from './internalDocumentLink'

const origin = window.location.origin
const here = '/test'

describe('classifyInternalDocumentLink', () => {
  it('classifies a heading deep link by id (ignores the breadcrumb h param)', () => {
    expect(classifyInternalDocumentLink(`${origin}/test?h=a%3Eb&id=h-setup`, here)).toEqual({
      kind: 'heading',
      headingId: 'h-setup'
    })
  })

  it('classifies the canonical chat dialect with and without a message', () => {
    expect(classifyInternalDocumentLink(`${origin}/test?chatroom=c1&msg_id=m1`, here)).toEqual({
      kind: 'chat',
      channelId: 'c1',
      messageId: 'm1'
    })
    expect(classifyInternalDocumentLink(`${origin}/test?chatroom=c1`, here)).toEqual({
      kind: 'chat',
      channelId: 'c1',
      messageId: undefined
    })
  })

  it('translates the legacy act=ch chat dialect', () => {
    expect(classifyInternalDocumentLink(`${origin}/test?act=ch&c_id=c2&m_id=m2`, here)).toEqual({
      kind: 'chat',
      channelId: 'c2',
      messageId: 'm2'
    })
  })

  it('classifies filter path segments and the and/or mode', () => {
    expect(classifyInternalDocumentLink(`${origin}/test/apple`, here)).toEqual({
      kind: 'filter',
      terms: ['apple'],
      mode: 'or',
      href: `${origin}/test/apple`
    })
    expect(classifyInternalDocumentLink(`${origin}/test/apple/carrot?mode=and`, here)).toEqual({
      kind: 'filter',
      terms: ['apple', 'carrot'],
      mode: 'and',
      href: `${origin}/test/apple/carrot?mode=and`
    })
    expect(classifyInternalDocumentLink(`${origin}/test/apple%20pie`, here)).toEqual({
      kind: 'filter',
      terms: ['apple pie'],
      mode: 'or',
      href: `${origin}/test/apple%20pie`
    })
  })

  it('classifies history hashes, tolerating a missing or invalid version', () => {
    expect(classifyInternalDocumentLink(`${origin}/test#history?version=194`, here)).toEqual({
      kind: 'history',
      version: 194
    })
    expect(classifyInternalDocumentLink(`${origin}/test#history`, here)).toEqual({
      kind: 'history',
      version: null
    })
    expect(classifyInternalDocumentLink(`${origin}/test#history?version=foo`, here)).toEqual({
      kind: 'history',
      version: null
    })
  })

  it('classifies a bare same-document link as the document itself', () => {
    expect(classifyInternalDocumentLink(`${origin}/test`, here)).toEqual({ kind: 'document' })
  })

  it('returns null for a different document (exact slug match, not startsWith)', () => {
    expect(classifyInternalDocumentLink(`${origin}/other?id=x`, here)).toBeNull()
    expect(classifyInternalDocumentLink(`${origin}/testing?id=x`, here)).toBeNull()
  })

  it('returns null for external origins and non-http schemes', () => {
    expect(classifyInternalDocumentLink(`https://evil.example/test?id=x`, here)).toBeNull()
    expect(classifyInternalDocumentLink(`mailto:hi@example.com`, here)).toBeNull()
  })

  it('returns null for an unparseable href', () => {
    expect(classifyInternalDocumentLink('http://', here)).toBeNull()
  })
})
