/// <reference types="cypress" />

import type { Node as PMNode } from '@tiptap/pm/model'

import { expectSelectedFrame } from './selectedFrame'

const MEDIA_SRC = {
  image: 'https://example.com/photo.png',
  video: 'https://example.com/clip.mp4',
  audio: 'https://example.com/track.mp3',
  youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  vimeo: 'https://vimeo.com/123456789',
  soundcloud: 'https://soundcloud.com/forss/flickermood',
  spotify: 'https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl',
  loom: 'https://www.loom.com/share/abcdef1234567890'
} as const

const text = (value: string) => ({ type: 'text', text: value })
const paragraph = (value?: string) => ({
  type: 'paragraph',
  ...(value ? { content: [text(value)] } : {})
})
const heading = { type: 'heading', attrs: { level: 2 }, content: [text('Title')] }
const bulletList = {
  type: 'bulletList',
  content: [{ type: 'listItem', content: [paragraph('item')] }]
}

function setDoc(content: object[]): void {
  cy.getEditor().then((editor) => {
    editor.commands.setContent({ type: 'doc', content })
  })
}

function focusFirstEmptyLine(): void {
  cy.getEditor().then((editor) => {
    let pos = -1
    editor.state.doc.forEach((node: PMNode, offset: number) => {
      if (pos === -1 && node.type.name === 'paragraph' && node.content.size === 0) pos = offset + 1
    })
    expect(pos, 'empty line position').to.be.greaterThan(-1)
    editor.commands.focus(pos)
  })
}

// `realPress` is a parent command and ignores focus: gate on it first.
function press(key: 'Backspace' | 'Delete'): void {
  cy.get('#editor .ProseMirror').should('have.focus')
  cy.realPress(key)
}

function paragraphCount(): Cypress.Chainable<number> {
  return cy.get('#editor .ProseMirror').then(($root) => $root.find('p').length)
}

function expectParagraphCount(count: number): void {
  cy.get('#editor .ProseMirror').should(($root) => {
    expect($root.find('p').length, 'rendered paragraphs').to.eq(count)
  })
}

function expectNothingSelected(): void {
  cy.get('#editor .ProseMirror-selectednode').should('not.exist')
}

function expectHeadingAndListIntact(): void {
  cy.get('#editor .ProseMirror h2').should('have.text', 'Title')
  cy.get('#editor .ProseMirror ul li').should('have.length', 1).and('have.text', 'item')
}

describe('Backspace and Delete next to media select it before deleting it', () => {
  describe('inline image', () => {
    beforeEach(() => {
      cy.visitPlayground('inlineImage=true')
    })

    it('removes the empty line, then selects the image, then deletes it', () => {
      cy.setEditorContent(
        `<h2>Title</h2><p><img src="${MEDIA_SRC.image}"></p><p></p><ul><li><p>item</p></li></ul>`
      )
      cy.get('#editor .hypermultimedia--image__content').should('have.length', 1)
      paragraphCount().then((before) => {
        focusFirstEmptyLine()
        press('Backspace')
        expectParagraphCount(before - 1)
      })
      cy.nodeCount('image').should('eq', 1)
      expectNothingSelected()
      cy.getEditor().then((editor) => {
        const { selection } = editor.state
        expect(selection.empty, 'collapsed caret').to.eq(true)
        expect(selection.$from.nodeBefore?.type.name, 'caret after the image').to.eq('image')
      })

      press('Backspace')
      cy.nodeCount('image').should('eq', 1)
      cy.get('#editor .hypermultimedia--image__content.ProseMirror-selectednode').should('exist')
      expectSelectedFrame()

      press('Backspace')
      cy.nodeCount('image').should('eq', 0)
      cy.get('#editor .hypermultimedia--image__content').should('not.exist')
      expectHeadingAndListIntact()
    })

    it('Delete before the image selects it, and the next Delete deletes it', () => {
      cy.setEditorContent(`<p><img src="${MEDIA_SRC.image}"></p><p>end</p>`)
      cy.getEditor().then((editor) => {
        editor.commands.focus(1)
      })
      press('Delete')
      cy.nodeCount('image').should('eq', 1)
      expectSelectedFrame()

      press('Delete')
      cy.nodeCount('image').should('eq', 0)
      cy.get('#editor .ProseMirror p').last().should('have.text', 'end')
    })

    it('Delete at the end of the image line removes the empty line under it and keeps the image', () => {
      cy.setEditorContent(`<p><img src="${MEDIA_SRC.image}"></p><p></p><p>end</p>`)
      paragraphCount().then((before) => {
        cy.getEditor().then((editor) => {
          editor.commands.focus(2)
        })
        press('Delete')
        expectParagraphCount(before - 1)
      })
      cy.nodeCount('image').should('eq', 1)
      expectNothingSelected()
      cy.get('#editor .ProseMirror p').last().should('have.text', 'end')
      cy.getEditor().then((editor) => {
        expect(editor.state.selection.$from.nodeBefore?.type.name).to.eq('image')
      })
    })
  })

  describe('block media', () => {
    beforeEach(() => {
      cy.visitPlayground()
    })

    Object.entries(MEDIA_SRC).forEach(([name, src]) => {
      it(`${name}: removes the empty line, then selects the node, then deletes it`, () => {
        setDoc([heading, { type: name, attrs: { src } }, paragraph(), bulletList])
        cy.nodeCount(name).should('eq', 1)
        paragraphCount().then((before) => {
          focusFirstEmptyLine()
          press('Backspace')
          expectParagraphCount(before - 1)
        })
        cy.nodeCount(name).should('eq', 1)
        cy.get('#editor .ProseMirror-gapcursor').should('exist')
        expectNothingSelected()
        cy.getEditor().then((editor) => {
          const { $from, empty } = editor.state.selection
          expect(empty, 'collapsed caret').to.eq(true)
          expect($from.parent.isTextblock, 'caret between blocks').to.eq(false)
          expect($from.nodeBefore?.type.name, 'caret after the media').to.eq(name)
        })

        press('Backspace')
        cy.nodeCount(name).should('eq', 1)
        expectSelectedFrame()
        expectHeadingAndListIntact()

        press('Backspace')
        cy.nodeCount(name).should('eq', 0)
        expectHeadingAndListIntact()
      })
    })

    it('Delete at the end of a text line selects the embed after it, and the next Delete deletes it', () => {
      setDoc([paragraph('text'), { type: 'youtube', attrs: { src: MEDIA_SRC.youtube } }])
      cy.getEditor().then((editor) => {
        editor.commands.focus(5)
      })
      press('Delete')
      cy.nodeCount('youtube').should('eq', 1)
      expectSelectedFrame()

      press('Delete')
      cy.nodeCount('youtube').should('eq', 0)
      cy.get('#editor .ProseMirror p').first().should('have.text', 'text')
    })

    it('Delete at the gap cursor removes the next empty line and keeps the embed', () => {
      setDoc([{ type: 'youtube', attrs: { src: MEDIA_SRC.youtube } }, paragraph(), paragraph()])
      focusFirstEmptyLine()
      press('Backspace')
      cy.get('#editor .ProseMirror-gapcursor').should('exist')
      paragraphCount().then((before) => {
        press('Delete')
        expectParagraphCount(before - 1)
      })
      cy.nodeCount('youtube').should('eq', 1)
      cy.get('#editor .ProseMirror-gapcursor').should('exist')
      expectNothingSelected()
    })
  })
})

export {}
