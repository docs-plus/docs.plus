/* eslint-disable no-undef */
import { TEST_TITLE } from '../../../support/commands'
import { section, paragraph, heading, bulletList, listItem } from '../../../fixtures/docMaker'

export const TAB = '\t'

/** DOM — keep one source of truth (see lists/bullet-list.cy.js: Tab targets `.docy_editor`). */
export const EDITOR = '.docy_editor'
export const PM = `${EDITOR} .tiptap.ProseMirror`

/** Small delays for UI / ProseMirror (avoid flaky realPress races). */
export const MS = { ui: 50, cmd: 100, list: 250, key: 200 }

export { TEST_TITLE, section, paragraph, heading, bulletList, listItem }

export function heading1(text) {
  return {
    type: 'heading',
    attrs: { level: 1 },
    content: [{ type: 'text', text }]
  }
}

export function paragraphNode(text) {
  return {
    type: 'paragraph',
    content: text === '' ? [] : [{ type: 'text', text }]
  }
}

export function docNestedBulletTwoLevels() {
  return {
    type: 'doc',
    content: [
      heading1('Nested list coverage'),
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              paragraphNode('Top'),
              {
                type: 'bulletList',
                content: [
                  {
                    type: 'listItem',
                    content: [paragraphNode('Nested')]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}

export function docMixedParagraphAndList() {
  return {
    type: 'doc',
    content: [
      heading1('Mixed'),
      paragraphNode('Plain body'),
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [paragraphNode('OnlyItem')]
          }
        ]
      },
      paragraphNode('After list')
    ]
  }
}

/** H1 + two top-level list items (bullet or ordered). */
export function docH1WithTwoListItems(listType, title, first, second) {
  const listKey = listType === 'orderedList' ? 'orderedList' : 'bulletList'
  return {
    type: 'doc',
    content: [
      heading1(title),
      {
        type: listKey,
        content: [
          { type: 'listItem', content: [paragraphNode(first)] },
          { type: 'listItem', content: [paragraphNode(second)] }
        ]
      }
    ]
  }
}

export function getEditor(win) {
  const ed = win._editor
  if (!ed) throw new Error('window._editor missing')
  return ed
}

export function getText(win) {
  return getEditor(win).getText()
}

/** Register `visitEditor` + `clearEditor` for indent specs (call at top of `describe` body). */
export function setupIndentSpec(docName) {
  before(() => {
    cy.visitEditor({ persist: false, docName })
  })
  beforeEach(() => {
    cy.clearEditor()
  })
}

/**
 * Caret position at start of paragraph text for the first paragraph whose `textContent` equals `text`.
 * @returns {number | null}
 */
export function paragraphTextCaretPos(editor, text) {
  let p = null
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'paragraph' && node.textContent === text) p = pos + 1
  })
  return p
}

/** Inclusive paragraph text range → selection bounds (for multiline indent tests). */
export function paragraphSelectionBounds(editor, startText, endText) {
  let from = null
  let to = null
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'paragraph' && node.textContent === startText) from = pos + 1
    if (node.type.name === 'paragraph' && node.textContent === endText) {
      to = pos + 1 + (node.textContent?.length ?? 0)
    }
  })
  return { from, to }
}

export function setDoc(content) {
  cy.window().then((win) => {
    getEditor(win).chain().focus().setContent(content).run()
  })
}

export function seedEmptySection() {
  cy.createDocument({
    documentName: TEST_TITLE.HelloDocy,
    sections: [section(TEST_TITLE.short, [])]
  })
}

export function startBulletListFromEmptyParagraph() {
  cy.get(`${PM} > p`).first().click()
  cy.get(EDITOR).realPress(['Meta', 'Shift', '8'])
}

export function insertTable2x2() {
  cy.window().then((win) => {
    getEditor(win)
      .chain()
      .focus()
      .setContent([heading1('Table'), paragraphNode('')])
      .insertTable({ rows: 2, cols: 2, withHeaderRow: false })
      .run()
  })
  cy.get(`${PM} table`).should('exist')
  cy.get(`${PM} table td`).should('have.length', 4)
}
