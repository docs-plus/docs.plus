const EDITOR = '.docy_editor .tiptap.ProseMirror'
const MOD = Cypress.platform === 'darwin' ? 'Meta' : 'Control'

const p = (text) =>
  text ? { type: 'paragraph', content: [{ type: 'text', text }] } : { type: 'paragraph' }
const li = (text, sublist) => ({
  type: 'listItem',
  content: sublist ? [p(text), sublist] : [p(text)]
})
const ul = (...items) => ({ type: 'bulletList', content: items })
const ol = (...items) => ({ type: 'orderedList', content: items })
const title = { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] }

const WIFI_LIST = ul(li('Venue'), li('Wi-Fi', ul(li('SSID'), li('Password'))))
const DRIVE_LIST = ul(li('Planning'), li('Drive', ul(li('Nested'))))
const NESTED_GAP = [WIFI_LIST, p(''), DRIVE_LIST]

const seed = (blocks) => {
  cy.window().then((win) => {
    win._editor.commands.setContent({ type: 'doc', content: [title, ...blocks] })
  })
  cy.get(`${EDITOR} > p`).should('have.length', 1)
}

// `gap` is the first top-level empty paragraph; a string is the end of that text.
const placeCaret = (target) => {
  cy.window().then((win) => {
    const editor = win._editor
    let pos = null
    if (target === 'gap') {
      editor.state.doc.forEach((node, offset) => {
        if (pos == null && node.type.name === 'paragraph' && node.content.size === 0)
          pos = offset + 1
      })
    } else {
      editor.state.doc.descendants((node, nodePos) => {
        if (pos != null) return false
        if (node.isTextblock && node.textContent === target) pos = nodePos + 1 + node.content.size
      })
    }
    expect(pos, `caret target ${target}`).to.be.a('number')
    editor.commands.setTextSelection(pos)
    editor.view.focus()
  })
  cy.get(EDITOR).should('have.focus')
}

// ProseMirror keeps a trailing <br> in an empty paragraph, so `:empty` never matches.
const assertNoEmptyParagraphInItems = () => {
  cy.get(`${EDITOR} li p`).should(($paragraphs) => {
    const empty = $paragraphs.filter((_, el) => el.textContent === '')
    expect(empty, 'empty paragraphs inside list items').to.have.length(0)
  })
}

const assertOneJoinedBulletList = () => {
  cy.get(`${EDITOR} > ul`).should('have.length', 1)
  cy.get(`${EDITOR} > ul > li`).should('have.length', 4)
  cy.get(`${EDITOR} > ul > li:nth-child(2) > ul > li`).should('have.length', 2)
  cy.get(`${EDITOR} > ul > li:nth-child(4) > ul > li`).should('have.length', 1)
  cy.get(`${EDITOR} > p`).should('not.exist')
  assertNoEmptyParagraphInItems()
}

describe('Empty paragraph between two lists', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: true, clearDoc: true, docName: 'list-gap-join' })
  })

  it('joins two bullet lists when Backspace is pressed in the gap', () => {
    seed(NESTED_GAP)
    placeCaret('gap')
    cy.realPress('Backspace')
    assertOneJoinedBulletList()
  })

  it('joins two bullet lists when Delete is pressed in the gap', () => {
    seed(NESTED_GAP)
    placeCaret('gap')
    cy.realPress('Delete')
    assertOneJoinedBulletList()
  })

  it('joins two bullet lists without moving the gap into the item when Delete is pressed after the last nested item', () => {
    seed(NESTED_GAP)
    placeCaret('Password')
    cy.realPress('Delete')
    assertOneJoinedBulletList()
    cy.get(`${EDITOR} > ul > li:nth-child(2) > p`).should('have.length', 1)
  })

  it('removes the gap before a following heading when Delete is pressed after the last nested item', () => {
    seed([WIFI_LIST, p('')])
    placeCaret('Password')
    cy.realPress('Delete')
    cy.get(`${EDITOR} > p`).should('not.exist')
    cy.get(`${EDITOR} > ul > li`).should('have.length', 2)
    assertNoEmptyParagraphInItems()
  })

  it('joins two bullet lists when Shift+Backspace is pressed in the gap', () => {
    seed(NESTED_GAP)
    placeCaret('gap')
    cy.realPress(['Shift', 'Backspace'])
    assertOneJoinedBulletList()
  })

  it('joins two ordered lists when Backspace is pressed in the gap', () => {
    seed([ol(li('Venue'), li('Wi-Fi')), p(''), ol(li('Planning'), li('Drive'))])
    placeCaret('gap')
    cy.realPress('Backspace')
    cy.get(`${EDITOR} > ol`).should('have.length', 1)
    cy.get(`${EDITOR} > ol > li`).should('have.length', 4)
    cy.get(`${EDITOR} > p`).should('not.exist')
    assertNoEmptyParagraphInItems()
  })

  it('removes the gap but keeps ordered lists of different types apart when Shift+Backspace is pressed', () => {
    const letteredList = { ...ol(li('Planning')), attrs: { type: 'a' } }
    seed([ol(li('Venue'), li('Wi-Fi')), p(''), letteredList])
    placeCaret('gap')
    cy.realPress(['Shift', 'Backspace'])
    cy.get(`${EDITOR} > p`).should('not.exist')
    cy.get(`${EDITOR} > ol`).should('have.length', 2)
    cy.get(`${EDITOR} > ol`).first().children('li').should('have.length', 2)
    cy.get(`${EDITOR} > ol`).last().children('li').should('have.length', 1)
    assertNoEmptyParagraphInItems()
  })

  it('restores both lists and the gap with one undo after a join', () => {
    seed(NESTED_GAP)
    // Outlast the Yjs undo captureTimeout (500 ms) so the seed and the join stay two steps.
    cy.wait(700)
    placeCaret('gap')
    cy.realPress('Backspace')
    assertOneJoinedBulletList()
    cy.realPress([MOD, 'z'])
    cy.get(`${EDITOR} > ul`).should('have.length', 2)
    cy.get(`${EDITOR} > p`).should('have.length', 1)
    cy.get(`${EDITOR} > ul`).first().next().should('match', 'p')
  })
})
