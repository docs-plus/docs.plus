/// <reference types="jest" />
import {
  CHAT_PANE_DOC_FLOOR_PX,
  CHAT_PANE_FLOOR_PX,
  resolveChatPaneHeight,
  snapChatPaneMode
} from './chatPaneGeometry'

/** Measured height of the pad header the pane sits below. */
const TITLE = 61

describe('resolveChatPaneHeight', () => {
  it('returns 0 when closed', () => {
    expect(resolveChatPaneHeight({ shellHeight: 844, reservedHeight: TITLE, mode: 'closed' })).toBe(
      0
    )
  })

  it('honors the ratio when both floors fit', () => {
    expect(resolveChatPaneHeight({ shellHeight: 844, reservedHeight: TITLE, mode: 'half' })).toBe(
      422
    )
  })

  it('leaves exactly the document floor in expanded mode', () => {
    const height = resolveChatPaneHeight({
      shellHeight: 844,
      reservedHeight: TITLE,
      mode: 'expanded'
    })
    expect(844 - TITLE - height).toBe(CHAT_PANE_DOC_FLOOR_PX)
  })

  it('keeps the document floor when the keyboard shrinks the shell', () => {
    const height = resolveChatPaneHeight({
      shellHeight: 508,
      reservedHeight: TITLE,
      mode: 'expanded'
    })
    expect(508 - TITLE - height).toBe(CHAT_PANE_DOC_FLOOR_PX)
  })

  it('raises a too-small half to the pane floor rather than hiding the composer', () => {
    // Short shell: the ratio wants 150, below the furniture floor.
    expect(resolveChatPaneHeight({ shellHeight: 300, reservedHeight: TITLE, mode: 'half' })).toBe(
      CHAT_PANE_FLOOR_PX
    )
  })

  it('lets the pane keep its floor when both floors cannot fit', () => {
    expect(
      resolveChatPaneHeight({ shellHeight: 200, reservedHeight: TITLE, mode: 'expanded' })
    ).toBe(CHAT_PANE_FLOOR_PX)
  })

  it('grows the pane when the pad header is absent', () => {
    const withHeader = resolveChatPaneHeight({
      shellHeight: 844,
      reservedHeight: TITLE,
      mode: 'expanded'
    })
    const without = resolveChatPaneHeight({ shellHeight: 844, reservedHeight: 0, mode: 'expanded' })
    expect(without - withHeader).toBe(TITLE)
  })
})

describe('snapChatPaneMode', () => {
  it('closes when the drag ends well below half', () => {
    expect(snapChatPaneMode({ height: 300, halfHeight: 422, expandedHeight: 687 })).toBe('closed')
  })

  it('settles to half below the midpoint', () => {
    expect(snapChatPaneMode({ height: 500, halfHeight: 422, expandedHeight: 687 })).toBe('half')
  })

  it('settles to expanded at or above the midpoint', () => {
    expect(snapChatPaneMode({ height: 555, halfHeight: 422, expandedHeight: 687 })).toBe('expanded')
  })
})
