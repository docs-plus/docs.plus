/* eslint-disable no-undef */
/**
 * #700: a same-pad paste keeps each heading's `toc-id`, because heading chats and `?id=`
 * links pair by it. A pasted copy of a taken id, and any paste from elsewhere, gets a new id.
 * `realPress` sends Meta+C as a bare key, and Chrome on macOS copies only through edit
 * commands. So each chord goes through CDP with its command, on the real clipboard.
 */

const EDITOR = '.docy_editor > .tiptap.ProseMirror'
const DOC =
  '<h1>Pad Title</h1><h2>Alpha</h2><p>Body a</p><h2>Beta</h2><p>Body b</p><h3>Gamma</h3><p>Body g</p>'

const cdp = (command, params) =>
  cy.then(() => Cypress.automation('remote:debugger:protocol', { command, params }))

const chord = (key, command) => {
  const vk = key.toUpperCase().charCodeAt(0)
  const event = { key, code: `Key${key.toUpperCase()}`, modifiers: 4, windowsVirtualKeyCode: vk }
  cdp('Input.dispatchKeyEvent', { type: 'keyDown', ...event, commands: [command] })
  cdp('Input.dispatchKeyEvent', { type: 'keyUp', ...event })
}
const selectAll = () => chord('a', 'SelectAll')
const copy = () => chord('c', 'Copy')
const cut = () => chord('x', 'Cut')
const paste = () => chord('v', 'Paste')

const freshName = (name) => `toc-id-paste-${name}-${Date.now()}`

const openPad = (docName) => {
  cy.visit(`/editor?localPersistence=true&docName=${docName}`)
  cy.get(EDITOR).should('be.visible')
}

const seed = () => {
  cy.window().then((win) => win._editor.commands.setContent(DOC))
  cy.get(`${EDITOR} h3[data-toc-id]`).should('have.length', 1)
}

/** Heading text and id in doc order, read from the editor state. */
const headings = () =>
  cy.window().then((win) => {
    const list = []
    win._editor.state.doc.descendants((node) => {
      if (node.type.name === 'heading')
        list.push({ text: node.textContent, id: node.attrs['toc-id'] })
    })
    return list
  })

/** The position at the end of the first textblock whose text is `text`. */
const textEnd = (win, text) => {
  let end = null
  win._editor.state.doc.descendants((node, pos) => {
    if (end === null && node.isTextblock && node.textContent === text) end = pos + node.nodeSize - 1
  })
  return end
}

const focusEditor = (where) => {
  cy.get(EDITOR).click()
  cy.window().then((win) => win._editor.commands.focus(where))
}

/** The pad id the editor stamps and reserves, read from the editor itself. */
const padIdOf = (win) =>
  win._editor.extensionManager.extensions.find((e) => e.name === 'uniqueID').options.padId

/**
 * Drags the Beta section (end of "Body a" to end of "Body b") to the end of "Body g".
 * Synthetic DragEvents: a real CDP drag needs `Input.setInterceptDrags`.
 */
const dragBetaToEnd = ({ copy }) => {
  cy.window().then((win) => {
    const editor = win._editor
    editor.commands.setTextSelection({ from: textEnd(win, 'Body a'), to: textEnd(win, 'Body b') })
    const dataTransfer = new win.DataTransfer()
    // A built DataTransfer pins effectAllowed to "none". A real drag keeps ProseMirror's
    // "copyMove", which is what makes upstream UniqueID strip ids on the drop.
    let effectAllowed = 'uninitialized'
    Object.defineProperty(dataTransfer, 'effectAllowed', {
      get: () => effectAllowed,
      set: (value) => (effectAllowed = value)
    })
    const fire = (target, type, init = {}) =>
      target.dispatchEvent(
        new win.DragEvent(type, { bubbles: true, cancelable: true, dataTransfer, ...init })
      )
    fire(editor.view.dom.querySelector('h2:nth-of-type(2)'), 'dragstart')
    const at = editor.view.coordsAtPos(textEnd(win, 'Body g'))
    const point = { clientX: at.left, clientY: (at.top + at.bottom) / 2 }
    const target = win.document.elementFromPoint(point.clientX, point.clientY)
    fire(target, 'dragover', point)
    // ProseMirror reads the copy key at drop: Alt on macOS, Ctrl elsewhere.
    fire(target, 'drop', { ...point, altKey: copy, ctrlKey: copy })
  })
}

const expectAllUnique = (list) => {
  const ids = list.map((h) => h.id)
  expect(ids.every(Boolean), 'every heading has an id').to.equal(true)
  expect(new Set(ids).size, 'no id appears twice').to.equal(ids.length)
}

describe('Paste keeps heading toc-ids from the same pad (#700)', () => {
  beforeEach(() => {
    cdp('Browser.grantPermissions', {
      origin: new URL(Cypress.config('baseUrl')).origin,
      permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite']
    })
  })

  it('a full cut and paste keeps every id', () => {
    openPad(freshName('cut'))
    seed()
    headings().then((original) => {
      focusEditor('end')
      selectAll()
      cut()
      cy.get(EDITOR).should('not.contain', 'Body g')
      paste()
      cy.get(EDITOR).should('contain', 'Body g')
      headings().should('deep.equal', original)
    })
  })

  it('a select-all paste over the pad keeps every id', () => {
    openPad(freshName('select-all'))
    seed()
    headings().then((original) => {
      focusEditor('end')
      selectAll()
      copy()
      // A paste that never lands must not pass, so the pad changes before it.
      cy.window().then((win) => win._editor.commands.insertContent('<h2>Throwaway</h2>'))
      cy.get(EDITOR).should('contain', 'Throwaway')
      selectAll()
      paste()
      cy.get(EDITOR).should('not.contain', 'Throwaway')
      headings().should('deep.equal', original)
    })
  })

  it('a copy inside the pad keeps the originals and re-keys the copies', () => {
    openPad(freshName('copy'))
    seed()
    headings().then((original) => {
      focusEditor('end')
      selectAll()
      copy()
      focusEditor('end')
      paste()
      cy.get(`${EDITOR} h3`).should('have.length', 2)
      headings().then((after) => {
        expect(after.slice(0, original.length), 'originals').to.deep.equal(original)
        expectAllUnique(after)
      })
    })
  })

  it('a copy pasted above its original leaves the original its id', () => {
    openPad(freshName('above'))
    seed()
    headings().then((original) => {
      const beta = original.find((h) => h.text === 'Beta')
      // From the end of "Body a" to the end of "Body b" holds the whole Beta heading.
      focusEditor('end')
      cy.window().then((win) =>
        win._editor.commands.setTextSelection({
          from: textEnd(win, 'Body a'),
          to: textEnd(win, 'Body b')
        })
      )
      copy()
      cy.window().then((win) => win._editor.commands.setTextSelection(textEnd(win, 'Body a')))
      paste()
      cy.get(`${EDITOR} h2`).should('have.length', 3)
      headings().then((after) => {
        const betas = after.filter((h) => h.text === 'Beta')
        expect(betas, 'two Beta headings').to.have.length(2)
        expect(betas[1].id, 'the original Beta, below the copy').to.equal(beta.id)
        expect(betas[0].id, 'the pasted copy').not.to.equal(beta.id)
        expectAllUnique(after)
      })
    })
  })

  it('a paste from another pad takes new ids', () => {
    openPad(freshName('source'))
    seed()
    headings().then((source) => {
      focusEditor('end')
      selectAll()
      copy()
      openPad(freshName('target'))
      cy.window().then((win) => win._editor.commands.setContent('<h1>Other pad</h1><p>Text</p>'))
      cy.get(`${EDITOR} h1[data-toc-id]`).should('have.length', 1)
      focusEditor('end')
      selectAll()
      paste()
      cy.get(EDITOR).should('contain', 'Body g').and('not.contain', 'Other pad')
      headings().then((after) => {
        expect(after.map((h) => h.text)).to.deep.equal(source.map((h) => h.text))
        const sourceIds = new Set(source.map((h) => h.id))
        expect(
          after.filter((h) => sourceIds.has(h.id)),
          'ids kept from the other pad'
        ).to.be.empty
        expectAllUnique(after)
      })
    })
  })

  it('a paste from another site takes new ids', () => {
    openPad(freshName('site'))
    seed()
    headings().then((original) => {
      // A site's HTML carries no pad mark, even when it holds our ids.
      cy.window().then((win) => cy.wrap(win._editor.getHTML()).as('html'))
      focusEditor('end')
      cy.window().then((win) => win._editor.commands.selectAll())
      cy.get('@html').then((html) =>
        cy.pasteWithMimeTypes({ 'text/html': `${html}<p>From the site</p>` })
      )
      cy.get(EDITOR).should('contain', 'From the site')
      headings().then((after) => {
        expect(after.map((h) => h.text)).to.deep.equal(original.map((h) => h.text))
        const ids = new Set(original.map((h) => h.id))
        expect(
          after.filter((h) => ids.has(h.id)),
          'ids kept from the site'
        ).to.be.empty
        expectAllUnique(after)
      })
    })
  })

  it("another pad's paste re-keys even when its text spells this pad's mark", () => {
    openPad(freshName('mark-text'))
    seed()
    cy.window().then((win) => {
      // The mark as text, unescaped, as innerHTML writes a quote in a text node. A slice
      // opens into the caret's paragraph, so forged HTML leads with a paragraph.
      const html = `<p data-docsplus-pad="other-pad">Lead</p><h2 data-toc-id="forged-xyz">Forged</h2><p>data-docsplus-pad="${padIdOf(win)}"</p>`
      focusEditor('end')
      cy.pasteWithMimeTypes({ 'text/html': html })
    })
    cy.get(`${EDITOR} h2`).should('contain', 'Forged')
    headings().then((after) => {
      expect(after.map((h) => h.id)).not.to.include('forged-xyz')
      expectAllUnique(after)
    })
  })

  it("a paste with this pad's mark never keeps the documentId as a heading id", () => {
    openPad(freshName('reserved'))
    seed()
    cy.window().then((win) => {
      const padId = padIdOf(win)
      cy.wrap(padId).as('padId')
      focusEditor('end')
      cy.pasteWithMimeTypes({
        'text/html': `<p data-docsplus-pad="${padId}">Lead</p><h2 data-toc-id="${padId}">Forged</h2><p>x</p>`
      })
    })
    cy.get(`${EDITOR} h2`).should('contain', 'Forged')
    cy.get('@padId').then((padId) =>
      headings().then((after) => {
        expect(after.map((h) => h.id)).not.to.include(padId)
        expectAllUnique(after)
      })
    )
  })

  it('a drag-move inside the pad keeps the heading id', () => {
    openPad(freshName('drag-move'))
    seed()
    headings().then((original) => {
      focusEditor('end')
      dragBetaToEnd({ copy: false })
      cy.get(`${EDITOR} > :last-child`).should('have.text', 'Body b')
      headings().then((after) => {
        expect(after.map((h) => h.text)).to.deep.equal(['Pad Title', 'Alpha', 'Gamma', 'Beta'])
        const ids = Object.fromEntries(after.map((h) => [h.text, h.id]))
        original.forEach((h) => expect(ids[h.text], h.text).to.equal(h.id))
      })
    })
  })

  it('a drag-copy inside the pad re-keys only the copy', () => {
    openPad(freshName('drag-copy'))
    seed()
    headings().then((original) => {
      const beta = original.find((h) => h.text === 'Beta')
      focusEditor('end')
      dragBetaToEnd({ copy: true })
      cy.get(`${EDITOR} h2`).should('have.length', 3)
      headings().then((after) => {
        const betas = after.filter((h) => h.text === 'Beta')
        expect(betas[0].id, 'the original Beta').to.equal(beta.id)
        expect(betas[1].id, 'the dropped copy').not.to.equal(beta.id)
        expectAllUnique(after)
      })
    })
  })
})
