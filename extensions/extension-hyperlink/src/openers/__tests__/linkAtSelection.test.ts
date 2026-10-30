/// <reference types="bun-types" />

import { describe, expect, it } from 'bun:test'
import { Schema } from '@tiptap/pm/model'
import { EditorState, TextSelection } from '@tiptap/pm/state'

import { linkAtSelection } from '../linkAtSelection'

// The mark is not named `hyperlink`, so the helper must read the type it is given.
const schema = new Schema({
  nodes: {
    doc: { content: 'paragraph+' },
    paragraph: { content: 'text*' },
    text: {}
  },
  marks: { anchorMark: { attrs: { href: { default: null } }, inclusive: false } }
})
const markType = schema.marks.anchorMark

// "Visit " is positions 1-7, "Example" is 7-14, " now" follows.
const doc = schema.node('doc', null, [
  schema.node('paragraph', null, [
    schema.text('Visit '),
    schema.text('Example', [markType.create({ href: 'https://example.com' })]),
    schema.text(' now')
  ])
])

const stateAt = (from: number, to = from): EditorState =>
  EditorState.create({ doc, selection: TextSelection.create(doc, from, to) })

describe('linkAtSelection', () => {
  it('returns the range and href when the caret is inside a link', () => {
    expect(linkAtSelection(stateAt(10), markType)).toEqual({
      from: 7,
      to: 14,
      href: 'https://example.com'
    })
  })

  it('returns null at the left edge of a link', () => {
    expect(linkAtSelection(stateAt(7), markType)).toBeNull()
  })

  it('returns null at the right edge of a link', () => {
    expect(linkAtSelection(stateAt(14), markType)).toBeNull()
  })

  it('returns null for a non-empty selection inside a link', () => {
    expect(linkAtSelection(stateAt(8, 10), markType)).toBeNull()
  })

  it('returns null for a caret in plain text', () => {
    expect(linkAtSelection(stateAt(3), markType)).toBeNull()
  })

  it('returns null between two touching links', () => {
    const touching = schema.node('doc', null, [
      schema.node('paragraph', null, [
        schema.text('One', [markType.create({ href: 'https://one.example' })]),
        schema.text('Two', [markType.create({ href: 'https://two.example' })])
      ])
    ])
    const state = EditorState.create({
      doc: touching,
      selection: TextSelection.create(touching, 4)
    })
    expect(linkAtSelection(state, markType)).toBeNull()
  })
})
