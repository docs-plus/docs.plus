/* eslint-disable no-undef */

const PM = '.docy_editor .tiptap.ProseMirror'

const DOC = [
  '<h1>Spacing title</h1>',
  '<h2>Section</h2>',
  '<p>After heading</p>',
  '<p>Second plain</p>',
  '<p data-paragraph-style="subtitle">Subtitle line</p>',
  '<p>After subtitle</p>',
  '<ul><li><p>List item</p></li></ul>',
  '<pre><code>code line</code></pre>',
  '<blockquote><p>Quoted</p></blockquote>',
  '<table><tbody><tr><td><p>Cell one</p></td><td><p>Cell two</p></td></tr></tbody></table>'
].join('')

const expectMarginTop = (selector, value) =>
  cy.get(selector).should(($el) => expect(getComputedStyle($el[0]).marginTop).to.eq(value))

describe('Paragraph spacing', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true, docName: 'paragraph-spacing' })
    cy.window().then((win) => win._editor.commands.setContent(DOC))
    cy.get(`${PM} > .tableWrapper`).should('exist')
  })

  it('puts a small gap between two plain paragraphs', () => {
    expectMarginTop(`${PM} > p:contains("Second plain")`, '4px')
  })

  it('keeps the block gap after a heading', () => {
    expectMarginTop(`${PM} > p:contains("After heading")`, '12px')
  })

  it('keeps the block gap after a subtitle', () => {
    expectMarginTop(`${PM} > p:contains("After subtitle")`, '12px')
  })

  it('keeps the block gap before a list', () => {
    expectMarginTop(`${PM} > ul`, '12px')
  })

  it('keeps the block gap on a code block, a blockquote and a table', () => {
    expectMarginTop(`${PM} > pre`, '12px')
    expectMarginTop(`${PM} > blockquote`, '12px')
    expectMarginTop(`${PM} > .tableWrapper`, '12px')
    expectMarginTop(`${PM} td p:contains("Cell one")`, '0px')
  })
})
