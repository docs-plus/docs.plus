/**
 * Headless slot-resolution tests for `openPreviewHyperlink`. Pure mock
 * editor shape — verifies the opener resolves
 * `popovers.previewHyperlink ?? prebuilt` and stays idle when the host
 * opts out (factory returns `null`). End-to-end mount + adopt is covered
 * by `cypress/e2e/preview-edit.cy.ts`.
 */
import { describe, expect, it, mock } from 'bun:test'

import { HYPERLINK_MARK_NAME } from '../../constants'
import { getDefaultController, resetDefaultController } from '../../floating-popover'
import type { PreviewHyperlinkOptions } from '../../hyperlink'
import { openPreviewHyperlink } from '../openPreviewHyperlink'

function fakeEditor(
  previewHyperlink: ((opts: PreviewHyperlinkOptions) => HTMLElement | null) | null
): Parameters<typeof openPreviewHyperlink>[0] {
  return {
    extensionManager: {
      extensions: [{ name: HYPERLINK_MARK_NAME, options: { popovers: { previewHyperlink } } }]
    }
  } as never
}

const dummyOpts: PreviewHyperlinkOptions = {
  editor: {} as never,
  link: {} as never,
  nodePos: 0,
  attrs: {
    href: 'https://example.com',
    target: null,
    rel: null,
    class: null,
    title: null,
    image: null
  }
}

describe('openPreviewHyperlink', () => {
  it('invokes the configured slot factory with the supplied opts', () => {
    resetDefaultController()
    const factory = mock<(o: PreviewHyperlinkOptions) => HTMLElement | null>(() => null)
    openPreviewHyperlink(fakeEditor(factory), dummyOpts)
    expect(factory).toHaveBeenCalledTimes(1)
    expect(factory.mock.calls[0][0]).toBe(dummyOpts)
  })

  it('stays idle when the slot factory returns null (host opt-out)', () => {
    resetDefaultController()
    openPreviewHyperlink(
      fakeEditor(() => null),
      dummyOpts
    )
    expect(getDefaultController().getState()).toEqual({ kind: 'idle' })
  })

  it('throws a clear error when the Hyperlink extension is not registered', () => {
    resetDefaultController()
    const editor = { extensionManager: { extensions: [] } } as never
    expect(() => openPreviewHyperlink(editor, dummyOpts)).toThrow(/Hyperlink extension/)
  })
})
