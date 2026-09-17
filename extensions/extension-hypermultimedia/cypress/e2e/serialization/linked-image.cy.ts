import type {} from '@docs.plus/extension-hyperlink'

const IMAGE_URL = 'https://example.com/photo.png'

describe('hyperlink marks on inline images', () => {
  it('preserves the image through link creation, URL editing, HTML round-trip, and unlinking', () => {
    cy.visitPlayground('inlineImage=true')
    cy.setEditorContent(`<p><img src="${IMAGE_URL}" alt="Example"></p>`)
    cy.getEditor().then((editor) => {
      editor.chain().setNodeSelection(1).setHyperlink({ href: 'https://example.com' }).run()
    })
    cy.get('#editor a img').should('have.attr', 'src', IMAGE_URL)

    cy.getEditor().then((editor) => {
      editor
        .chain()
        .setNodeSelection(1)
        .extendMarkRange('hyperlink')
        .editHyperlink({ newURL: 'https://changed.example' })
        .run()
      editor.commands.setContent(editor.getHTML())
    })
    cy.get('#editor a').should('have.attr', 'href', 'https://changed.example')
    cy.get('#editor a img').should('have.attr', 'src', IMAGE_URL)

    cy.getEditor().then((editor) => {
      editor.chain().setNodeSelection(1).unsetHyperlink().run()
    })
    cy.get('#editor a').should('not.exist')
    cy.get('#editor img').should('have.attr', 'src', IMAGE_URL)
  })
})

export {}
