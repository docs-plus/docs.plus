describe('text focus beside media', () => {
  it('keeps paragraph and heading clicks editable when the image extension is active', () => {
    cy.visitPlayground()
    cy.setEditorContent('<p>Paragraph</p><h2>Heading</h2>')
    cy.getEditor().then((editor) => {
      editor.commands.focus('end')
      editor.commands.setImage({ src: 'https://example.com/photo.png', width: 200, height: 150 })
    })

    for (const selector of ['p', 'h2']) {
      cy.get(`#editor ${selector}`).first().realClick({ position: 'left' })
      cy.get('#editor .ProseMirror').should('have.focus')
      cy.get(`#editor ${selector}`)
        .first()
        .then(($block) => {
          const target = $block[0]
          const rect = target.getBoundingClientRect()
          const win = target.ownerDocument.defaultView!
          target.dispatchEvent(
            new win.MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              clientX: rect.left + 4,
              clientY: rect.top + rect.height / 2
            })
          )
        })
      cy.get('#editor .ProseMirror').should('have.focus')
      cy.realType('typed ')
      cy.get(`#editor ${selector}`).first().should('contain.text', 'typed ')
    }
    cy.nodeCount('image').should('eq', 1)
  })
})

export {}
