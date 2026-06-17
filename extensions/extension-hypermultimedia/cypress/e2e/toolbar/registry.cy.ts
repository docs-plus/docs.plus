/// <reference types="cypress" />

import type {
  MediaActionsResolver,
  MediaToolbarFactory,
  ReplaceUrlPopoverFactory
} from '@docs.plus/extension-hypermultimedia'

function kitStorage(win: Cypress.AUTWindow) {
  const storage = win._editor.storage as unknown as {
    HyperMultimediaKit: {
      mediaActions?: MediaActionsResolver
      mediaToolbar?: MediaToolbarFactory
      replaceUrlPopover?: ReplaceUrlPopoverFactory
    }
  }
  return storage.HyperMultimediaKit
}

describe('media toolbar action registry', () => {
  beforeEach(() => cy.visitPlayground())

  it('splits base actions into inline and menu by placement', () => {
    cy.window().then((win) => {
      const { resolveMediaActions } = win._hypermultimedia
      const actions = resolveMediaActions(win._editor, 'image')
      const ids = actions.map((a) => a.id)
      expect(ids).to.include.members(['caption', 'align', 'view-original', 'copy', 'delete'])
      // inline bricks precede overflow bricks by array position (no numeric `order`)
      expect(ids.indexOf('caption')).to.be.lessThan(ids.indexOf('delete'))
    })
  })

  it('composeMediaActions reorders bricks by id', () => {
    cy.window().then((win) => {
      const { composeMediaActions, resolveMediaActions } = win._hypermultimedia
      const ids = composeMediaActions(resolveMediaActions(win._editor, 'image'))
        .move('caption', { before: 'align' })
        .result()
        .map((a) => a.id)
      expect(ids.indexOf('caption')).to.be.lessThan(ids.indexOf('align'))
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
      const storage = kitStorage(win)
      storage.mediaActions = (defaults) => defaults.filter((a) => a.id !== 'delete')
      const ids = win._hypermultimedia.resolveMediaActions(win._editor, 'image').map((a) => a.id)
      expect(ids).to.not.include('delete')
      storage.mediaActions = undefined
    })
  })

  it('mounts a custom mediaToolbar element once per hover and removes it on dismiss', () => {
    cy.window().then((win) => {
      // Plain unstyled div: lifecycle must key on the data-hm-toolbar stamp, not the skin class.
      kitStorage(win).mediaToolbar = () => {
        const bar = win.document.createElement('div')
        bar.dataset.testid = 'custom-media-bar'
        return bar
      }
    })
    cy.insertSizedImage(480, 320)
    cy.activateImageGripper()
    cy.get('#editor [data-testid="custom-media-bar"]').should('have.length', 1)

    cy.get('#editor p').first().trigger('pointerdown', { force: true })
    cy.get('#editor [data-testid="custom-media-bar"]').should('not.exist')

    cy.activateImageGripper()
    cy.get('#editor [data-testid="custom-media-bar"]').should('have.length', 1)
    cy.window().then((win) => {
      kitStorage(win).mediaToolbar = undefined
    })
  })

  it('routes Replace URL through the replaceUrlPopover slot, with null opting out', () => {
    cy.window().then((win) => {
      kitStorage(win).replaceUrlPopover = () => {
        const marker = win.document.createElement('div')
        marker.dataset.testid = 'custom-replace-popover'
        return marker
      }
    })
    cy.insertSizedImage(480, 320)
    cy.activateImageGripper()
    cy.get('#editor .media-toolbar .media-toolbar__more').click()
    cy.get('.floating-popover .media-toolbar__menu [data-action-id="replace"]').click()
    cy.get('.floating-popover [data-testid="custom-replace-popover"]').should('exist')

    cy.window().then((win) => {
      kitStorage(win).replaceUrlPopover = () => null
    })
    // Real mousedown dismisses the open popover; pointerdown tears down the hover chrome.
    cy.get('body').click(5, 5)
    cy.activateImageGripper()
    cy.get('#editor .media-toolbar .media-toolbar__more').click()
    cy.get('.floating-popover .media-toolbar__menu [data-action-id="replace"]').click()
    // Null factory: the host owns the surface — no dialog opens and the menu dismisses.
    cy.get('.floating-popover').should('not.exist')

    cy.window().then((win) => {
      kitStorage(win).replaceUrlPopover = undefined
    })
  })
})
