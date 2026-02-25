/* eslint-disable no-undef */

import { section } from '../../../fixtures/docMaker'
import { TEST_TITLE } from '../../../support/commands'

const DocumentStructure = {
  documentName: TEST_TITLE.HelloDocy,
  sections: [section(TEST_TITLE.short, [])]
}

const ROOT = '.docy_editor .heading[level="1"] .contentWrapper > .contents'
const BULLET_ITEMS = `${ROOT} > ul:not([data-type="taskList"]) > li`
const ORDERED_ITEMS = `${ROOT} > ol > li`
const TASK_ITEMS = `${ROOT} > ul[data-type="taskList"] > li`
const MOD_KEY = Cypress.platform === 'darwin' ? 'Meta' : 'Control'

const selectItemRange = (startText, endText = startText) =>
  cy.createSelection({
    startSection: 1,
    startParagraph: { text: startText },
    startPosition: 'start',
    endSection: 1,
    endParagraph: { text: endText },
    endPosition: 'end'
  })

const setProseMirrorListSelection = (startText, endText, nodeTypeName) => {
  cy.window().then((win) => {
    const editor = win._editor
    let from = null
    let to = null

    editor.state.doc.descendants((node, pos) => {
      if (node.type.name !== nodeTypeName) return

      const directLabel =
        node.firstChild?.type?.name === 'paragraph' ? node.firstChild.textContent : node.textContent

      if (from === null && directLabel.includes(startText)) {
        from = pos
      }
      if (directLabel.includes(endText)) {
        to = pos + node.nodeSize
      }
    })

    if (from === null || to === null) {
      throw new Error(`Unable to resolve ${nodeTypeName} range for "${startText}" -> "${endText}"`)
    }

    editor.chain().focus().setTextSelection({ from, to }).run()
  })
}

const selectListNodeRangeInDom = (itemSelector, startText, endText) => {
  cy.contains(itemSelector, startText).then(($startItem) => {
    cy.contains(itemSelector, endText).then(($endItem) => {
      cy.window().then((win) => {
        const range = win.document.createRange()
        range.setStartBefore($startItem[0])
        range.setEndAfter($endItem[0])

        const selection = win.getSelection()
        selection.removeAllRanges()
        selection.addRange(range)
      })
    })
  })
}

const cutSelectionInEditor = () => {
  cy.window().then((win) => {
    const editor = win._editor
    const { from, to } = editor.state.selection
    editor.view.dispatch(editor.state.tr.delete(from, to))
  })
}

const createListItems = (shortcut, itemSelector, items) => {
  cy.get(`${ROOT} > p`).first().click()
  cy.get('.docy_editor').realPress(shortcut)

  items.forEach((item, index) => {
    if (index > 0) {
      cy.get(itemSelector)
        .eq(index - 1)
        .realPress('Enter')
    }
    cy.get(itemSelector).eq(index).realType(item)
  })
}

const applyFormattingAndHyperlink = (itemText, shortcuts, href) => {
  selectItemRange(itemText)
  shortcuts.forEach((shortcut) => {
    cy.get('.docy_editor').realPress(shortcut)
  })

  selectItemRange(itemText)
  cy.get('.docy_editor').realPress([MOD_KEY, 'k'])
  cy.get('.hyperlinkCreatePopover').should('be.visible')
  cy.get('.hyperlinkCreatePopover input[name="hyperlink-url"]').clear().type(href)
  cy.get('.hyperlinkCreatePopover button[type="submit"]').click()
}

const pasteAtListEnd = (itemSelector) => {
  cy.get(itemSelector).last().click().realPress('End').realPress('Enter')
  cy.get('.docy_editor > .tiptap.ProseMirror').pasteClipboardHtml()
}

const assertRichClipboardSignals = () => {
  cy.get(`${ROOT} a[href*="native-"]`).its('length').should('be.gte', 1)
  cy.get(`${ROOT} strong, ${ROOT} em, ${ROOT} u, ${ROOT} s, ${ROOT} mark`)
    .its('length')
    .should('be.gte', 1)
}

const exitListToParagraph = (itemSelector) => {
  cy.get(itemSelector).last().click().realPress('End')
  // Empty list item + Enter exits list in TipTap.
  cy.get('.docy_editor').realPress('Enter').realPress('Enter')
}

describe('Native List Clipboard Smoke (Headed)', () => {
  beforeEach(function () {
    // Native clipboard coverage remains headed-only to keep default headless
    // CI runs deterministic and non-flaky.
    if (!Cypress.browser.isHeaded) {
      this.skip()
    }

    cy.visitEditor({ persist: false, clearDoc: true, docName: 'native-list-clipboard-headed' })
    cy.createDocument(DocumentStructure)
    cy.wait(200)
  })

  const listCases = [
    {
      name: 'bullet list',
      shortcut: [MOD_KEY, 'Shift', '8'],
      itemSelector: BULLET_ITEMS,
      nodeTypeName: 'listItem'
    },
    {
      name: 'ordered list',
      shortcut: [MOD_KEY, 'Shift', '7'],
      itemSelector: ORDERED_ITEMS,
      nodeTypeName: 'listItem'
    },
    {
      name: 'task list',
      shortcut: [MOD_KEY, 'Shift', '9'],
      itemSelector: TASK_ITEMS,
      nodeTypeName: 'taskItem'
    }
  ]

  listCases.forEach(({ name, shortcut, itemSelector, nodeTypeName }) => {
    it(`${name}: native copy/paste preserves multi-item mixed marks + hyperlinks`, () => {
      const items = [
        'NATIVE-ALPHA bold-link item',
        'NATIVE-BETA italic-underline-link item',
        'NATIVE-GAMMA strike-highlight-link item',
        'NATIVE-TAIL destination item'
      ]

      createListItems(shortcut, itemSelector, items)

      applyFormattingAndHyperlink(items[0], [[MOD_KEY, 'b']], 'https://native-alpha.example')
      applyFormattingAndHyperlink(
        items[1],
        [
          [MOD_KEY, 'i'],
          [MOD_KEY, 'u']
        ],
        'https://native-beta.example'
      )
      applyFormattingAndHyperlink(
        items[2],
        [
          [MOD_KEY, 'Shift', 's'],
          [MOD_KEY, 'Shift', 'h']
        ],
        'https://native-gamma.example'
      )

      cy.get(itemSelector).its('length').as('beforeCopyItemCount')
      cy.get(`${ROOT} a[href*="native-"]`).its('length').as('beforeCopyLinkCount')

      selectListNodeRangeInDom(itemSelector, items[0], items[2])
      cy.get('.docy_editor > .tiptap.ProseMirror').copySelectionToClipboard()

      pasteAtListEnd(itemSelector)

      cy.get('@beforeCopyItemCount').then((beforeCount) => {
        cy.get(itemSelector).its('length').should('be.gte', beforeCount)
      })
      cy.get('@beforeCopyLinkCount').then((beforeLinkCount) => {
        cy.get(`${ROOT} a[href*="native-"]`).its('length').should('be.gte', beforeLinkCount)
      })
      assertRichClipboardSignals()
      if (nodeTypeName === 'taskItem') {
        cy.get(itemSelector)
          .its('length')
          .then((itemCount) => {
            cy.get(`${ROOT} ul[data-type="taskList"] input[type="checkbox"]`)
              .its('length')
              .should('be.gte', itemCount)
          })
      }
      cy.assertFullSchemaValid()
    })

    it(`${name}: native cut/paste preserves multi-item mixed marks + hyperlinks`, () => {
      const items = [
        'NATIVE-ALPHA bold-link item',
        'NATIVE-BETA italic-underline-link item',
        'NATIVE-GAMMA strike-highlight-link item',
        'NATIVE-TAIL destination item'
      ]

      createListItems(shortcut, itemSelector, items)

      applyFormattingAndHyperlink(items[0], [[MOD_KEY, 'b']], 'https://native-alpha.example')
      applyFormattingAndHyperlink(
        items[1],
        [
          [MOD_KEY, 'i'],
          [MOD_KEY, 'u']
        ],
        'https://native-beta.example'
      )
      applyFormattingAndHyperlink(
        items[2],
        [
          [MOD_KEY, 'Shift', 's'],
          [MOD_KEY, 'Shift', 'h']
        ],
        'https://native-gamma.example'
      )

      cy.get(itemSelector).its('length').as('beforeCutItemCount')

      setProseMirrorListSelection(items[0], items[2], nodeTypeName)
      selectListNodeRangeInDom(itemSelector, items[0], items[2])
      cy.get('.docy_editor > .tiptap.ProseMirror').copySelectionToClipboard()
      cutSelectionInEditor()

      cy.get('@beforeCutItemCount').then((beforeCount) => {
        cy.get(itemSelector).its('length').should('be.lte', beforeCount)
      })
      cy.get(itemSelector).its('length').as('afterCutItemCount')

      pasteAtListEnd(itemSelector)

      cy.get('@afterCutItemCount').then((afterCutCount) => {
        cy.get(itemSelector).its('length').should('be.gte', afterCutCount)
      })
      assertRichClipboardSignals()
      if (nodeTypeName === 'taskItem') {
        cy.get(itemSelector)
          .its('length')
          .then((itemCount) => {
            cy.get(`${ROOT} ul[data-type="taskList"] input[type="checkbox"]`)
              .its('length')
              .should('be.gte', itemCount)
          })
      }
      cy.assertFullSchemaValid()
    })
  })

  it('native cross-list smoke: bullet copy -> ordered paste keeps rich clipboard signals', () => {
    const sourceItems = [
      'SOURCE-ALPHA bold-link item',
      'SOURCE-BETA italic-underline-link item',
      'SOURCE-GAMMA strike-highlight-link item',
      'SOURCE-TAIL item'
    ]

    createListItems([MOD_KEY, 'Shift', '8'], BULLET_ITEMS, sourceItems)

    applyFormattingAndHyperlink(sourceItems[0], [[MOD_KEY, 'b']], 'https://native-alpha.example')
    applyFormattingAndHyperlink(
      sourceItems[1],
      [
        [MOD_KEY, 'i'],
        [MOD_KEY, 'u']
      ],
      'https://native-beta.example'
    )
    applyFormattingAndHyperlink(
      sourceItems[2],
      [
        [MOD_KEY, 'Shift', 's'],
        [MOD_KEY, 'Shift', 'h']
      ],
      'https://native-gamma.example'
    )

    cy.get(`${ROOT} a[href*="native-"]`).its('length').as('beforeCrossPasteLinks')
    selectListNodeRangeInDom(BULLET_ITEMS, sourceItems[0], sourceItems[2])
    cy.get('.docy_editor > .tiptap.ProseMirror').copySelectionToClipboard()

    exitListToParagraph(BULLET_ITEMS)
    cy.get('.docy_editor').realPress([MOD_KEY, 'Shift', '7'])
    cy.get(ORDERED_ITEMS).last().realType('DEST-ORDERED-ANCHOR')

    pasteAtListEnd(ORDERED_ITEMS)

    cy.get(ORDERED_ITEMS).its('length').should('be.gte', 2)
    cy.get('@beforeCrossPasteLinks').then((beforeLinkCount) => {
      cy.get(`${ROOT} a[href*="native-"]`).its('length').should('be.gte', beforeLinkCount)
    })
    assertRichClipboardSignals()
    cy.assertFullSchemaValid()
  })

  it('native task-list copy/paste smoke preserves checkbox and rich clipboard signals', () => {
    const items = ['TASK-SOURCE-ALPHA', 'TASK-SOURCE-BETA', 'TASK-SOURCE-GAMMA', 'TASK-SOURCE-TAIL']

    createListItems([MOD_KEY, 'Shift', '9'], TASK_ITEMS, items)
    cy.get(`${ROOT} ul[data-type="taskList"] input[type="checkbox"]`).first().click()

    applyFormattingAndHyperlink(items[0], [[MOD_KEY, 'b']], 'https://native-alpha.example')
    applyFormattingAndHyperlink(
      items[1],
      [
        [MOD_KEY, 'i'],
        [MOD_KEY, 'u']
      ],
      'https://native-beta.example'
    )
    applyFormattingAndHyperlink(
      items[2],
      [
        [MOD_KEY, 'Shift', 's'],
        [MOD_KEY, 'Shift', 'h']
      ],
      'https://native-gamma.example'
    )

    cy.get(TASK_ITEMS).its('length').as('beforeTaskCopyCount')
    cy.get(`${ROOT} ul[data-type="taskList"] input[type="checkbox"]:checked`)
      .its('length')
      .as('beforeCheckedCount')
    selectListNodeRangeInDom(TASK_ITEMS, items[0], items[2])
    cy.get('.docy_editor > .tiptap.ProseMirror').copySelectionToClipboard()

    pasteAtListEnd(TASK_ITEMS)

    cy.get('@beforeTaskCopyCount').then((beforeCount) => {
      cy.get(TASK_ITEMS).its('length').should('be.gte', beforeCount)
    })
    cy.get('@beforeCheckedCount').then((beforeChecked) => {
      cy.get(`${ROOT} ul[data-type="taskList"] input[type="checkbox"]:checked`)
        .its('length')
        .should('be.gte', beforeChecked)
    })
    cy.contains(TASK_ITEMS, items[1]).should('exist')
    cy.contains(TASK_ITEMS, items[2]).should('exist')
    cy.get(`${ROOT} ul[data-type="taskList"] input[type="checkbox"]`)
      .its('length')
      .should('be.gte', 1)
    assertRichClipboardSignals()
    cy.assertFullSchemaValid()
  })

  it('native cross-list cut smoke: ordered -> bullet paste keeps clipboard signals', () => {
    const items = ['ORDERED-CUT-ALPHA', 'ORDERED-CUT-BETA', 'ORDERED-CUT-GAMMA', 'ORDERED-CUT-TAIL']

    createListItems([MOD_KEY, 'Shift', '7'], ORDERED_ITEMS, items)

    applyFormattingAndHyperlink(items[0], [[MOD_KEY, 'b']], 'https://native-alpha.example')
    applyFormattingAndHyperlink(
      items[1],
      [
        [MOD_KEY, 'i'],
        [MOD_KEY, 'u']
      ],
      'https://native-beta.example'
    )
    applyFormattingAndHyperlink(
      items[2],
      [
        [MOD_KEY, 'Shift', 's'],
        [MOD_KEY, 'Shift', 'h']
      ],
      'https://native-gamma.example'
    )

    cy.get(ORDERED_ITEMS).its('length').as('beforeOrderedCutCount')
    setProseMirrorListSelection(items[0], items[2], 'listItem')
    selectListNodeRangeInDom(ORDERED_ITEMS, items[0], items[2])
    cy.get('.docy_editor > .tiptap.ProseMirror').copySelectionToClipboard()
    cutSelectionInEditor()

    cy.get('@beforeOrderedCutCount').then((beforeCount) => {
      cy.get(ORDERED_ITEMS).its('length').should('be.lte', beforeCount)
    })
    exitListToParagraph(ORDERED_ITEMS)
    cy.get('.docy_editor').realPress([MOD_KEY, 'Shift', '8'])
    cy.get(BULLET_ITEMS).last().realType('DEST-BULLET-ANCHOR')
    cy.get(BULLET_ITEMS).its('length').as('beforeBulletPasteCount')

    pasteAtListEnd(BULLET_ITEMS)

    cy.get('@beforeBulletPasteCount').then((beforeBulletCount) => {
      cy.get(BULLET_ITEMS).its('length').should('be.gte', beforeBulletCount)
    })
    cy.contains(BULLET_ITEMS, items[1]).should('exist')
    cy.contains(BULLET_ITEMS, items[2]).should('exist')
    assertRichClipboardSignals()
    cy.assertFullSchemaValid()
  })
})
