/// <reference types="cypress" />

describe('resize after edits above the media node', () => {
  it('commits the drag to the image (no RangeError) after the paragraph above grows', () => {
    cy.visitPlayground()
    // Keyed-widget reuse means the gripper outlives doc edits; a stale drag-end
    // position must neither throw nor write to a foreign node.
    cy.on('uncaught:exception', (err) => {
      expect(err.message, 'no stale-position RangeError during resize commit').to.not.match(
        /out of range|RangeError/i
      )
    })

    cy.setEditorContent('<p>edit me</p>')
    cy.getEditor().then((editor) => {
      editor.commands.focus('end')
    })
    cy.insertSizedImage(200, 150)
    cy.activateImageGripper()

    // Type a sentence into the paragraph ABOVE the image — shifts the image's doc position.
    cy.get('#editor .ProseMirror p').first().click()
    cy.get('#editor .ProseMirror').realType('this sentence moves the media node further down ')

    cy.activateImageGripper()
    cy.dragResizeClamp('right', 60)

    cy.nodeCount('image').should('eq', 1)
    cy.nodeAttr('image', 'width').should((width) => {
      expect(Number(width)).to.be.greaterThan(200)
    })
    cy.nodeAttr('image', 'width').then((width) => {
      cy.expectRenderedMediaSize('#editor img', 'width', Number(width))
    })
    // The paragraph above is untouched by the resize commit.
    cy.get('#editor .ProseMirror p')
      .first()
      .should('contain.text', 'this sentence moves the media node further down')
  })
})

export {}
