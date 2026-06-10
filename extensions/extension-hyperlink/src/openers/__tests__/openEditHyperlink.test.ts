/**
 * Headless tests for `openEditHyperlink` — slot resolution and host
 * opt-out. End-to-end mount + Back navigation is covered by
 * `cypress/e2e/preview-edit.cy.ts`.
 */
import { afterEach, describe, expect, it, mock } from 'bun:test'

import { HYPERLINK_MARK_NAME } from '../../constants'
import { getDefaultController, resetDefaultController } from '../../floating-popover'
import type { EditHyperlinkOptions } from '../../hyperlink'
import { openEditHyperlink } from '../openEditHyperlink'

function fakeEditor(
  editHyperlink: ((opts: EditHyperlinkOptions) => HTMLElement | null) | null
): EditHyperlinkOptions['editor'] {
  return {
    extensionManager: {
      extensions: [{ name: HYPERLINK_MARK_NAME, options: { popovers: { editHyperlink } } }]
    }
  } as never
}

afterEach(() => {
  resetDefaultController()
})

describe('openEditHyperlink', () => {
  it('invokes the configured slot factory with the supplied opts', () => {
    const factory = mock<(o: EditHyperlinkOptions) => HTMLElement | null>(() => null)
    const opts: EditHyperlinkOptions = { editor: fakeEditor(factory), link: {} as never }
    openEditHyperlink(opts)
    expect(factory).toHaveBeenCalledTimes(1)
    expect(factory.mock.calls[0][0]).toBe(opts)
  })

  it('stays idle when the slot factory opts out (returns null)', () => {
    openEditHyperlink({ editor: fakeEditor(() => null), link: {} as never })
    expect(getDefaultController().getState()).toEqual({ kind: 'idle' })
  })

  it('throws a clear error when the Hyperlink extension is not registered', () => {
    const editor = { extensionManager: { extensions: [] } } as never
    expect(() => openEditHyperlink({ editor, link: {} as never })).toThrow(/Hyperlink extension/)
  })
})
