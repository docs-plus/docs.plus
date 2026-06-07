import { describe, expect, it } from 'bun:test'

import { Hyperlink } from '../hyperlink'

describe('HyperlinkOptions.popovers', () => {
  it('exposes three popover slots with `null` defaults', () => {
    const defaults = Hyperlink.config.addOptions!.call({} as never)
    expect(Object.keys(defaults.popovers).sort()).toEqual([
      'createHyperlink',
      'editHyperlink',
      'previewHyperlink'
    ])
    expect(defaults.popovers.editHyperlink).toBeNull()
  })
})
