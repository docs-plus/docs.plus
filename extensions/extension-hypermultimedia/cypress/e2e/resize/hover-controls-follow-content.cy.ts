/// <reference types="cypress" />

const ACTIVE_GRIPPER = '#editor .hypermultimedia__resize-gripper--active'
const IMAGE_WRAPPER = '#editor .hypermultimedia--image__content'

/** Remote y-sync transactions reduce to programmatic doc changes at the PM level. */
function insertParagraphsAbove(count: number): void {
  cy.getEditor().then((editor) => {
    for (let i = 0; i < count; i += 1) {
      editor.commands.insertContentAt(0, `<p>remote insert ${i + 1}</p>`)
    }
  })
}

function expectGripperCoversImage(tolerancePx = 2): void {
  cy.get(ACTIVE_GRIPPER).then(($gripper) => {
    cy.get('#editor img').then(($img) => {
      const gripper = $gripper[0].getBoundingClientRect()
      const img = $img[0].getBoundingClientRect()
      expect(gripper.top, 'gripper top tracks the image').to.be.closeTo(img.top, tolerancePx)
      expect(gripper.left, 'gripper left tracks the image').to.be.closeTo(img.left, tolerancePx)
      expect(gripper.width, 'gripper width tracks the image').to.be.closeTo(img.width, tolerancePx)
      expect(gripper.height, 'gripper height tracks the image').to.be.closeTo(
        img.height,
        tolerancePx
      )
    })
  })
}

function expectToolbarInsideWrapper(): void {
  cy.get(`${IMAGE_WRAPPER} > .media-toolbar`).then(($toolbar) => {
    cy.get(IMAGE_WRAPPER).then(($wrapper) => {
      const toolbar = $toolbar[0].getBoundingClientRect()
      const wrapper = $wrapper[0].getBoundingClientRect()
      expect(toolbar.top, 'toolbar rides the wrapper').to.be.within(wrapper.top, wrapper.bottom)
      expect(toolbar.right, 'toolbar stays in the wrapper').to.be.at.most(wrapper.right + 1)
    })
  })
}

describe('hover controls follow the media node when content shifts it', () => {
  // The editor is never focused: the hover controls own Delete only while focus is outside it.
  beforeEach(() => {
    cy.visitPlayground()
    cy.setEditorContent('<p>before</p>')
    cy.insertSizedImage(200, 150)
    cy.activateImageGripper()
    cy.get(`${IMAGE_WRAPPER} > .media-toolbar`).should('exist')
  })

  it('keeps the gripper and toolbar on the image after a remote-style insert above', () => {
    cy.get('#editor img').then(($img) => {
      const topBefore = $img[0].getBoundingClientRect().top
      insertParagraphsAbove(1)
      // The layout shift is the precondition; without it the tracking assertions prove nothing.
      cy.get('#editor img').should(($imgAfter) => {
        expect($imgAfter[0].getBoundingClientRect().top).to.be.greaterThan(topBefore)
      })
    })
    expectGripperCoversImage()
    expectToolbarInsideWrapper()
  })

  it('survives a burst of inserts without drifting or duplicating controls', () => {
    insertParagraphsAbove(20)
    cy.get('#editor .ProseMirror p').should('have.length.at.least', 21)
    cy.nodeCount('image').should('eq', 1)
    cy.get('#editor .hypermultimedia__resize-gripper--active').should('have.length', 1)
    cy.get(`${IMAGE_WRAPPER} > .media-toolbar`).should('have.length', 1)
    expectGripperCoversImage()
    expectToolbarInsideWrapper()
  })

  it('deletes the shifted node via the Delete key, leaving the inserted content intact', () => {
    insertParagraphsAbove(2)
    // Synthetic keydown reaches the document-capture listener; focus stays outside the editor.
    cy.get('#editor .ProseMirror').trigger('keydown', { key: 'Delete', bubbles: true })

    cy.nodeCount('image').should('eq', 0)
    cy.get(ACTIVE_GRIPPER).should('not.exist')
    cy.get('#editor .media-toolbar').should('not.exist')
    cy.get('#editor .ProseMirror p').should('contain.text', 'remote insert 1')
    cy.get('#editor .ProseMirror p').should('contain.text', 'remote insert 2')
    cy.get('#editor .ProseMirror p').should('contain.text', 'before')
  })
})

export {}
