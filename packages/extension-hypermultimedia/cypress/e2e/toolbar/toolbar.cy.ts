/// <reference types="cypress" />

describe('media toolbar overlay', () => {
  it('mounts top-right inside the image and exposes inline + overflow actions', () => {
    cy.visitPlayground()
    cy.insertSizedImage(480, 320)
    cy.activateImageGripper()
    cy.get('#editor .hypermultimedia--image__content .media-toolbar').should('exist')

    // overlay sits within the media bounds, pinned right
    cy.get('#editor .hypermultimedia--image__content').then(($wrap) => {
      const wrap = $wrap[0].getBoundingClientRect()
      cy.get('#editor .media-toolbar').then(($bar) => {
        const bar = $bar[0].getBoundingClientRect()
        expect(bar.top).to.be.greaterThan(wrap.top - 1)
        expect(wrap.right - bar.right).to.be.lessThan(40)
      })
    })

    cy.get('#editor .media-toolbar [data-action-id="align"]').should('exist')
    cy.get('#editor .media-toolbar [data-action-id="view-original"]').should('exist')
    cy.get('#editor .media-toolbar [data-action-id="download"]').should('exist')
    cy.get('#editor .media-toolbar .media-toolbar__more').should('exist')
  })

  it('changes alignment through the inline submenu (rendered, not just attrs)', () => {
    cy.visitPlayground()
    cy.insertSizedImage(480, 320)
    cy.activateImageGripper()
    cy.get('#editor .media-toolbar [data-action-id="align"]').click()
    cy.get('.media-toolbar__submenu .media-toolbar__submenu-item').contains('Center').click()
    cy.nodeAttr('image', 'margin').should('eq', 'auto')
    cy.get('#editor .hypermultimedia--image__content').should(($el) => {
      expect($el[0].style.margin).to.match(/auto/)
    })
  })

  it('deletes the node from the overflow menu', () => {
    cy.visitPlayground()
    cy.insertSizedImage(480, 320)
    cy.activateImageGripper()
    cy.get('#editor .media-toolbar .media-toolbar__more').click()
    cy.get('.media-toolbar__menu [data-action-id="delete"]').click()
    cy.nodeCount('image').should('eq', 0)
  })

  it('hides View original for host-uploaded image/video/audio', () => {
    cy.visitPlayground('uploaded=true')
    cy.insertSizedImage(480, 320)
    cy.activateImageGripper()
    cy.get('#editor .media-toolbar [data-action-id="view-original"]').should('not.exist')
  })
})
