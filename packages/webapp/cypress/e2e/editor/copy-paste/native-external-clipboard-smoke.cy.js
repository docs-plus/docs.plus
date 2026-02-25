/* eslint-disable no-undef */
import { paragraph, section } from '../../../fixtures/docMaker'

const TargetDocument = {
  documentName: 'Native External Clipboard Target',
  sections: [section('Native External Clipboard Target', [paragraph('seed')])]
}

describe(
  'Clipboard Smoke - External Fixture to Editor',
  {
    electron: true
  },
  () => {
    beforeEach(() => {
      cy.viewport(1280, 900)
      cy.visitEditor({ persist: true, docName: 'native_external_clipboard_target', clearDoc: true })
      cy.createDocument(TargetDocument)
    })

    it('pastes documentation fixture HTML into editor with valid schema', () => {
      cy.readFile('public/external-html/documentation.html').then((fullHtml) => {
        cy.window().then((win) => {
          const parser = new win.DOMParser()
          const doc = parser.parseFromString(fullHtml, 'text/html')
          const fixtureContent = doc.querySelector('#content-to-copy')?.innerHTML || ''

          expect(fixtureContent).to.have.length.greaterThan(0)

          const clipboardItem = new win.ClipboardItem({
            'text/html': new win.Blob([fixtureContent], { type: 'text/html' })
          })

          return win.navigator.clipboard.write([clipboardItem])
        })
      })

      cy.visitEditor({ persist: true, docName: 'native_external_clipboard_target' })
      cy.get('.docy_editor .ProseMirror').realClick().pasteClipboardHtml()
      cy.wait(500)

      cy.get('.docy_editor').should('contain', 'map()')
      cy.get('.docy_editor').should('contain', 'Syntax')
      cy.get('.docy_editor pre code, .docy_editor code').should('exist')
      cy.assertFullSchemaValid()
    })
  }
)
