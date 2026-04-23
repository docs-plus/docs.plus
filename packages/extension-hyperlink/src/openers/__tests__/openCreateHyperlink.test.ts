/**
 * Headless tests for `openCreateHyperlink` — slot resolution and
 * opt-out behaviour. End-to-end mount + selection-anchored positioning
 * is covered by `cypress/e2e/create.cy.ts`.
 */
import { afterEach, describe, expect, it, mock } from 'bun:test'

import { HYPERLINK_MARK_NAME } from '../../constants'
import { getDefaultController, resetDefaultController } from '../../floating-popover'
import type { CreateHyperlinkOptions } from '../../hyperlink'
import { openCreateHyperlink } from '../openCreateHyperlink'

function fakeEditor(
  createHyperlink: ((opts: CreateHyperlinkOptions) => HTMLElement | null) | null
): Parameters<typeof openCreateHyperlink>[0] {
  return {
    state: { selection: { from: 0, to: 0 } },
    extensionManager: {
      extensions: [
        {
          name: HYPERLINK_MARK_NAME,
          options: { popovers: { createHyperlink }, validate: undefined }
        }
      ]
    },
    view: { dom: {}, coordsAtPos: () => ({ left: 0, top: 0, right: 0, bottom: 0 }) }
  } as never
}

afterEach(() => {
  resetDefaultController()
})

describe('openCreateHyperlink', () => {
  it('returns false when the slot factory opts out (returns null)', () => {
    expect(
      openCreateHyperlink(
        fakeEditor(() => null),
        {}
      )
    ).toBe(false)
    expect(getDefaultController().getState()).toEqual({ kind: 'idle' })
  })

  it('invokes the configured slot factory with editor + extension wiring', () => {
    const factory = mock<(opts: CreateHyperlinkOptions) => HTMLElement | null>(() => null)
    openCreateHyperlink(fakeEditor(factory), { href: 'https://example.com' })
    expect(factory).toHaveBeenCalledTimes(1)
    expect(factory.mock.calls[0][0].extensionName).toBe(HYPERLINK_MARK_NAME)
    expect(factory.mock.calls[0][0].attributes).toEqual({ href: 'https://example.com' })
  })

  it('throws a clear error when the Hyperlink extension is not registered', () => {
    const editor = {
      state: { selection: { from: 0, to: 0 } },
      extensionManager: { extensions: [] },
      view: { dom: {}, coordsAtPos: () => ({ left: 0, top: 0, right: 0, bottom: 0 }) }
    } as never
    expect(() => openCreateHyperlink(editor, {})).toThrow(/Hyperlink extension/)
  })
})
