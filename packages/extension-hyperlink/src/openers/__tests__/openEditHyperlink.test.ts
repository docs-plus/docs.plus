/**
 * Headless tests for `openEditHyperlink` — slot resolution, stash
 * lifecycle, and controller subscription. End-to-end mount + Back
 * navigation is covered by `cypress/e2e/preview-edit.cy.ts`.
 */
import { afterEach, describe, expect, it, mock } from 'bun:test'

import { HYPERLINK_MARK_NAME } from '../../constants'
import { getDefaultController, resetDefaultController } from '../../floating-popover'
import type { EditHyperlinkOptions } from '../../hyperlink'
import {
  _resetEditOpenerSubscription,
  consumeStashedEditOptions,
  openEditHyperlink
} from '../openEditHyperlink'

function fakeEditor(
  editHyperlink: ((opts: EditHyperlinkOptions) => HTMLElement | null) | null
): Parameters<typeof openEditHyperlink>[0] {
  return {
    extensionManager: {
      extensions: [{ name: HYPERLINK_MARK_NAME, options: { popovers: { editHyperlink } } }]
    }
  } as never
}

const dummyOpts: EditHyperlinkOptions = {
  editor: {} as never,
  link: {} as never
}

afterEach(() => {
  _resetEditOpenerSubscription()
  resetDefaultController()
})

describe('openEditHyperlink', () => {
  it('invokes the configured slot factory with the supplied opts', () => {
    const factory = mock<(o: EditHyperlinkOptions) => HTMLElement | null>(() => null)
    openEditHyperlink(fakeEditor(factory), dummyOpts)
    expect(factory).toHaveBeenCalledTimes(1)
    expect(factory.mock.calls[0][0]).toBe(dummyOpts)
  })

  it('clears the stash when the slot factory opts out (returns null)', () => {
    openEditHyperlink(
      fakeEditor(() => null),
      dummyOpts
    )
    expect(consumeStashedEditOptions()).toBeNull()
    expect(getDefaultController().getState()).toEqual({ kind: 'idle' })
  })

  it('throws a clear error when the Hyperlink extension is not registered', () => {
    const editor = { extensionManager: { extensions: [] } } as never
    expect(() => openEditHyperlink(editor, dummyOpts)).toThrow(/Hyperlink extension/)
  })

  it('clears the stash when an unrelated kind is adopted', () => {
    const factory = mock<(o: EditHyperlinkOptions) => HTMLElement | null>(() => null)
    openEditHyperlink(fakeEditor(factory), dummyOpts)
    // Ensure subscription is set up by exercising opener once.
    getDefaultController().adopt(
      { hide: () => undefined, destroy: () => undefined, updateReference: () => undefined },
      'preview',
      { element: {} as HTMLElement, referenceElement: null }
    )
    expect(consumeStashedEditOptions()).toBeNull()
  })

  it('consume returns null when nothing has been stashed', () => {
    expect(consumeStashedEditOptions()).toBeNull()
  })
})
