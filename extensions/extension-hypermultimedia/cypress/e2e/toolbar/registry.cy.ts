/// <reference types="cypress" />

import type { MediaActionsResolver } from '@docs.plus/extension-hypermultimedia'

describe('media toolbar action registry', () => {
  beforeEach(() => cy.visitPlayground())

  it('splits base actions into inline and menu by placement', () => {
    cy.window().then((win) => {
      const { resolveMediaActions } = win._hypermultimedia
      const actions = resolveMediaActions(win._editor, 'image')
      const ids = actions.map((a) => a.id)
      expect(ids).to.include.members(['caption', 'align', 'view-original', 'copy', 'delete'])
      // ordering is ascending by `order`
      expect(ids.indexOf('caption')).to.be.lessThan(ids.indexOf('delete'))
    })
  })

  it('appends node-specific extras for x', () => {
    cy.window().then((win) => {
      const ids = win._hypermultimedia.resolveMediaActions(win._editor, 'x').map((a) => a.id)
      expect(ids).to.include('x-options')
    })
  })

  it('honours a host mediaActions override', () => {
    cy.window().then((win) => {
      // Playground exposes a setter to swap kit storage for this test.
      const storage = win._editor.storage as unknown as {
        HyperMultimediaKit: { mediaActions?: MediaActionsResolver }
      }
      storage.HyperMultimediaKit.mediaActions = (defaults) =>
        defaults.filter((a) => a.id !== 'delete')
      const ids = win._hypermultimedia.resolveMediaActions(win._editor, 'image').map((a) => a.id)
      expect(ids).to.not.include('delete')
      storage.HyperMultimediaKit.mediaActions = undefined
    })
  })
})
