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

    cy.get('#editor .media-toolbar > :first-child').should('have.attr', 'data-action-id', 'align')
    cy.get('#editor .media-toolbar [data-action-id="view-original"]').should('exist')
    cy.get('#editor .media-toolbar [data-action-id="download"]').should('exist')
    cy.get('#editor .media-toolbar .media-toolbar__more').should('exist')
  })

  it('shows a delayed floating tooltip on icon buttons in place of a native title', () => {
    cy.visitPlayground()
    cy.insertSizedImage(480, 320)
    cy.activateImageGripper()
    cy.get('#editor .media-toolbar [data-action-id="align"]').should('not.have.attr', 'title')
    cy.get('#editor .media-toolbar [data-action-id="align"]').trigger('mouseenter')
    // Cypress counts opacity: 0 as visible, so assert the rendered opacity itself.
    cy.get('.floating-tooltip').should('have.css', 'opacity', '1').and('have.text', 'Align')
    cy.get('#editor .media-toolbar [data-action-id="align"]').trigger('mouseleave')
    cy.get('.floating-tooltip').should('have.css', 'opacity', '0')
  })

  it('changes alignment through the inline submenu (rendered, not just attrs)', () => {
    cy.visitPlayground()
    cy.insertSizedImage(480, 320)
    cy.activateImageGripper()
    cy.get('#editor .media-toolbar').should('have.attr', 'aria-label', 'Media toolbar')
    cy.get('#editor .media-toolbar [data-action-id="align"]').click()
    // Fresh images default to Center (display block + margin auto).
    cy.get('.media-toolbar__submenu .media-toolbar__submenu-item--active')
      .should('have.attr', 'aria-pressed', 'true')
      .and('contain.text', 'Center')
    cy.get('.media-toolbar__submenu .media-toolbar__submenu-item').contains('Center').click()
    cy.nodeAttr('image', 'margin').should('eq', 'auto')
    cy.get('#editor .hypermultimedia--image__content').should(($el) => {
      expect($el[0].style.margin).to.match(/auto/)
    })
  })

  it('right-aligns the block through the Right placement (rendered, not just attrs)', () => {
    cy.visitPlayground()
    cy.insertSizedImage(480, 320)
    cy.activateImageGripper()
    cy.get('#editor .media-toolbar [data-action-id="align"]').click()
    cy.get('.media-toolbar__submenu .media-toolbar__submenu-item').contains('Right').click()
    cy.nodeAttr('image', 'margin').should('eq', '0 0 0 auto')
    cy.get('#editor .hypermultimedia--image__content').should(($el) => {
      const el = $el[0]
      expect(el.style.marginLeft, 'inline margin-left').to.eq('auto')
      const computedLeft = el.ownerDocument.defaultView!.getComputedStyle(el).marginLeft
      expect(parseFloat(computedLeft), 'computed margin-left').to.be.greaterThan(0)
    })
  })

  it('shows the margin control only for wrap placements and applies the picked margin', () => {
    cy.visitPlayground()
    cy.insertSizedImage(480, 320)
    cy.activateImageGripper()
    cy.get('#editor .media-toolbar [data-action-id="margin"]').should('not.exist')

    cy.get('#editor .media-toolbar [data-action-id="align"]').click()
    cy.get('.media-toolbar__submenu .media-toolbar__submenu-item').contains('Wrap left').click()
    // The pick tears the bar down; re-hover rebuilds it with the wrap attrs applied.
    cy.hoverMediaControls('#editor img')
    cy.get('#editor .media-toolbar [data-action-id="margin"]').should('contain.text', '1/2"')
    cy.get('#editor .media-toolbar [data-action-id="margin"] + .media-toolbar__divider').should(
      'be.visible'
    )
    cy.get('#editor .media-toolbar [data-action-id="margin"]').click()
    cy.get('.media-toolbar__submenu .media-toolbar__submenu-item').contains('1"').click()
    cy.get('#editor .hypermultimedia--image__content').should(($el) => {
      const el = $el[0]
      expect(el.style.margin, 'inline margin').to.eq('1in')
      const computedLeft = el.ownerDocument.defaultView!.getComputedStyle(el).marginLeft
      expect(parseFloat(computedLeft), 'computed margin-left').to.be.closeTo(96, 1)
    })
  })

  it('keeps wrap-left and wrap-right images inside the editor column', () => {
    const assertInsideColumn = () => {
      cy.get('#editor .ProseMirror').then(($pm) => {
        const column = $pm[0].getBoundingClientRect()
        cy.get('#editor .hypermultimedia--image__content').should(($media) => {
          const box = $media[0].getBoundingClientRect()
          expect(box.left, 'left edge').to.be.at.least(column.left - 1)
          expect(box.right, 'right edge').to.be.at.most(column.right + 1)
        })
      })
    }

    cy.visitPlayground()
    // Near full-column width so wrap margins would overflow without the float max-width cap.
    cy.insertSizedImage(720, 400)
    cy.activateImageGripper()
    cy.get('#editor .media-toolbar [data-action-id="align"]').click()
    cy.get('.media-toolbar__submenu .media-toolbar__submenu-item').contains('Wrap right').click()
    assertInsideColumn()

    cy.hoverMediaControls('#editor img')
    cy.get('#editor .media-toolbar [data-action-id="align"]').click()
    cy.get('.media-toolbar__submenu .media-toolbar__submenu-item').contains('Wrap left').click()
    assertInsideColumn()
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

  it('replaces the image URL from a dialog popover anchored below the node', () => {
    cy.visitPlayground()
    cy.insertSizedImage(480, 320)
    cy.activateImageGripper()
    cy.nodeAttr('image', 'keyId').then((keyId) => {
      cy.get('#editor .media-toolbar .media-toolbar__more').click()
      // Picking the row swaps the menu popover for the node-anchored dialog.
      cy.get('.floating-popover .media-toolbar__menu [data-action-id="replace"]').click()
      cy.get('.floating-popover[aria-label="Replace URL"]').should('be.visible')
      // Anchored to the node, placement bottom — with room below it must not flip.
      cy.get('#editor .hypermultimedia--image__content').then(($wrap) => {
        const wrapBottom = $wrap[0].getBoundingClientRect().bottom
        cy.get('.floating-popover[aria-label="Replace URL"]').should(($popover) => {
          expect($popover[0].getBoundingClientRect().top, 'popover top vs node bottom').to.be.gte(
            wrapBottom
          )
        })
      })
      cy.get('.floating-popover .media-toolbar__input').should(
        'have.value',
        'https://example.com/photo.png'
      )
      cy.get('.floating-popover .media-toolbar__input')
        .clear()
        .type('https://example.com/replaced.png')
      cy.get('.floating-popover .media-toolbar__submenu-item').contains('Replace').click()
      cy.nodeCount('image').should('eq', 1)
      cy.nodeAttr('image', 'keyId').should('eq', keyId)
      cy.get('#editor img').should('have.attr', 'src', 'https://example.com/replaced.png')
      // The attr commit tears the bar down (HIDE meta) and closes the popover.
      cy.get('#editor .media-toolbar').should('not.exist')
      cy.get('.floating-popover').should('not.exist')
    })
  })

  it('rejects a non-YouTube URL in Replace and keeps the youtube src', () => {
    cy.visitPlayground()
    cy.getEditor().then((editor) => {
      editor.commands.setYoutubeVideo({ src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
    })
    cy.get('#editor .hypermultimedia--youtube__content').trigger('mouseover', { force: true })
    cy.get('#editor .media-toolbar .media-toolbar__more').click()
    cy.get('.floating-popover .media-toolbar__menu [data-action-id="replace"]').click()
    cy.get('.floating-popover .media-toolbar__input').clear().type('https://vimeo.com/123456789')
    cy.get('.floating-popover .media-toolbar__submenu-item').contains('Replace').click()
    cy.get('.media-toolbar__error')
      .should('be.visible')
      .and('have.text', 'Enter a valid YouTube URL')
    cy.get('.floating-popover .media-toolbar__input').should('have.attr', 'aria-invalid', 'true')
    cy.nodeAttr('youtube', 'src').should('eq', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  })
})

export {}
