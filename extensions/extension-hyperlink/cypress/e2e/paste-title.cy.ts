/// <reference types="cypress" />

// Type-only: pulls StarterKit's undo command augmentation into this Cypress TS project.
import type {} from '@tiptap/starter-kit'

// The playground stub (`?pasteTitle=…`) answers after `delayMs` on the page clock, so `cy.tick`
// drives the answer and the 4 s deadline. Date is fake too: every transaction then has the same
// time, so prosemirror-history groups steps only where a history boundary closes a group.
const TIMERS: Cypress.ClockFunction[] = ['setTimeout', 'clearTimeout', 'Date']

const EDITABLE = '#editor [contenteditable="true"]'
const PAGE_URL = 'https://example.com/some/page'
const TITLE = 'Example Domain'

type Call = { href: string; signal: AbortSignal }

const visit = (mode: 'on' | 'slow' | 'throw' | 'null', extra = ''): void => {
  cy.visitPlayground({ query: `pasteTitle=${mode}${extra}` })
  // Kept out of history, so the last undo ends at the empty paragraph, not before the content.
  cy.getEditor().then((editor) => {
    editor.chain().setMeta('addToHistory', false).setContent('<p></p>').run()
  })
  cy.focusEditor('end')
  cy.clock(Date.now(), TIMERS)
}

const paste = (
  text: string,
  { shift = false, html }: { shift?: boolean; html?: string } = {}
): void => {
  // ProseMirror pastes plain text (a raw paste) while it has seen Shift go down.
  if (shift) cy.get(EDITABLE).trigger('keydown', { key: 'Shift', keyCode: 16, shiftKey: true })
  cy.window().then((win) => {
    const data = new win.DataTransfer()
    data.setData('text/plain', text)
    if (html) data.setData('text/html', html)
    cy.get(EDITABLE).trigger('paste', { clipboardData: data, bubbles: true, cancelable: true })
  })
  if (shift) cy.get(EDITABLE).trigger('keyup', { key: 'Shift', keyCode: 16 })
}

const calls = (): Cypress.Chainable<Call[]> =>
  cy.window().then((win) => win._pasteTitle?.calls ?? [])

// A page promise settled inside `cy.tick` runs its callbacks only at the next real task.
const flush = (): void => {
  cy.wrap(null).then(() => new Cypress.Promise<void>((done) => setTimeout(done, 0)))
}

const answer = (ms = 100): void => {
  cy.tick(ms)
  flush()
}

const linkText = (): Cypress.Chainable<string> =>
  cy.get('#editor a').should('have.length', 1).invoke('text')

const undo = (): void => {
  cy.getEditor().then((editor) => {
    editor.commands.undo()
  })
}

describe('pasteTitle', () => {
  it('swaps the URL for the page title, keeps the href and marks the transaction', () => {
    visit('on')
    const metas: unknown[] = []
    cy.getEditor().then((editor) => {
      editor.on('transaction', ({ transaction }) => {
        if (transaction.docChanged) metas.push(transaction.getMeta('pasteTitle'))
      })
    })
    paste(PAGE_URL)
    linkText().should('eq', PAGE_URL)
    calls().should('have.length', 1).its('0.href').should('eq', PAGE_URL)

    answer()
    linkText().should('eq', TITLE)
    cy.get('#editor a').should('have.attr', 'href', PAGE_URL)
    cy.wrap(metas).should('deep.equal', [undefined, true])
  })

  it('one undo restores the URL, and a second removes the paste', () => {
    visit('on')
    paste(PAGE_URL)
    answer()
    linkText().should('eq', TITLE)

    undo()
    linkText().should('eq', PAGE_URL)
    cy.get('#editor a').should('have.attr', 'href', PAGE_URL)
    undo()
    cy.get('#editor a').should('not.exist')
    cy.get('#editor p').should('have.text', '')
  })

  it('typing after the swap is its own undo step', () => {
    visit('on')
    paste(PAGE_URL)
    answer()
    linkText().should('eq', TITLE)
    cy.getEditor().then((editor) => {
      editor.chain().focus('end').insertContent(' ok').run()
    })
    cy.get('#editor p').should('have.text', `${TITLE} ok`)

    undo()
    cy.get('#editor p').should('have.text', TITLE)
    undo()
    cy.get('#editor p').should('have.text', PAGE_URL)
    undo()
    cy.get('#editor p').should('have.text', '')
  })

  it('a Shift paste makes a link with the URL as its text and fetches nothing', () => {
    visit('on')
    paste(PAGE_URL, { shift: true })
    linkText().should('eq', PAGE_URL)
    answer()
    calls().should('have.length', 0)
    linkText().should('eq', PAGE_URL)
  })

  it('an edit inside the link before the answer ends the job and aborts its signal', () => {
    visit('on')
    paste(PAGE_URL)
    calls().should('have.length', 1)
    cy.getEditor().then((editor) => {
      editor.commands.insertContentAt(3, 'X')
    })
    calls().its('0.signal.aborted').should('eq', true)
    answer()
    cy.get('#editor a').invoke('text').should('not.contain', TITLE)
  })

  it('no answer within 4 s aborts the signal and keeps the URL, even for a late answer', () => {
    visit('slow')
    paste(PAGE_URL)
    calls().should('have.length', 1)
    cy.tick(3999)
    calls().its('0.signal.aborted').should('eq', false)
    cy.tick(1)
    calls().its('0.signal.aborted').should('eq', true)
    answer(2000)
    linkText().should('eq', PAGE_URL)
  })

  it('destroying the editor aborts the signal', () => {
    visit('on')
    paste(PAGE_URL)
    calls().should('have.length', 1)
    cy.getEditor().then((editor) => {
      editor.destroy()
    })
    calls().its('0.signal.aborted').should('eq', true)
  })

  it('keeps the URL when the caret is inside the link at the answer', () => {
    visit('on')
    paste(PAGE_URL)
    cy.getEditor().then((editor) => {
      editor.commands.setTextSelection(5)
    })
    answer()
    calls().its('0.signal.aborted').should('eq', true)
    linkText().should('eq', PAGE_URL)
  })

  it('fetches nothing when shouldFetch returns false', () => {
    visit('on')
    paste('https://nofetch.example/page')
    linkText().should('eq', 'https://nofetch.example/page')
    answer()
    calls().should('have.length', 0)
  })

  it('starts nothing for a paste that is more than one URL', () => {
    visit('on')
    paste(`see ${PAGE_URL} today`)
    linkText().should('eq', PAGE_URL)
    answer()
    calls().should('have.length', 0)
  })

  it('fetches nothing for an HTML link whose URL the host gates refuse', () => {
    // `parseHTML` makes this link with no `shouldAutoLink` check; the armed href must still be gated.
    visit('on', '&shouldAutoLink=block')
    paste(PAGE_URL, { html: `<a href="${PAGE_URL}">${PAGE_URL}</a>` })
    linkText().should('eq', PAGE_URL)
    answer()
    calls().should('have.length', 0)
  })

  for (const mode of ['null', 'throw'] as const) {
    it(`keeps the URL when fetchTitle ${mode === 'null' ? 'answers null' : 'throws'}`, () => {
      visit(mode)
      paste(PAGE_URL)
      calls().should('have.length', 1)
      answer()
      calls().its('0.signal.aborted').should('eq', true)
      linkText().should('eq', PAGE_URL)
    })
  }
})

export {}
