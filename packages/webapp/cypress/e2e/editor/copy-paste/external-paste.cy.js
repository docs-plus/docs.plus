/* eslint-disable no-undef */
/**
 * External Paste Tests
 *
 * Tests for pasting content from external sources (other apps, web pages).
 * This tests the transformPastedHTML and transformPasted pipeline.
 */

import { section, paragraph } from '../../../fixtures/docMaker'

describe('External Paste - HTML from Other Sources', () => {
  beforeEach(() => {
    cy.visitEditor({ persist: false, clearDoc: true })
    cy.get('.docy_editor', { timeout: 15000 }).should('be.visible')
  })

  /**
   * Helper to simulate pasting HTML content
   */
  const pasteHtml = (html) => {
    cy.window().then((win) => {
      const editor = win._editor
      if (!editor) return

      const clipboardData = new DataTransfer()
      clipboardData.setData('text/html', html)
      clipboardData.setData('text/plain', html.replace(/<[^>]*>/g, ''))

      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true
      })

      editor.view.dom.dispatchEvent(pasteEvent)
    })
    cy.wait(100)
  }

  /**
   * Helper to simulate plain-text-only paste (equivalent to "paste without formatting")
   */
  const pastePlainText = (text) => {
    cy.window().then((win) => {
      const editor = win._editor
      if (!editor) return

      const clipboardData = new DataTransfer()
      clipboardData.setData('text/plain', text)

      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true
      })

      editor.view.dom.dispatchEvent(pasteEvent)
    })
    cy.wait(100)
  }

  describe('Plain HTML Headings', () => {
    it('should paste external H1 as new section', () => {
      cy.createDocument([section('Existing Section', [paragraph('Content')])])
      cy.wait(100)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      pasteHtml('<h1>External Section</h1><p>External content</p>')

      cy.get('.docy_editor').should('contain', 'External')

      // Validate schema
      cy.validateDocumentSchema().then((result) => {
        expect(result.valid, `Schema violations: ${result.errors.join(', ')}`).to.be.true
      })
    })

    it('should paste H2-H6 tags correctly', () => {
      cy.createDocument([section('Section', [paragraph('Content')])])
      cy.wait(100)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      pasteHtml('<h2>Heading 2</h2><h3>Heading 3</h3><p>Content</p>')

      cy.get('.docy_editor').should('contain', 'Heading 2')

      // Validate schema - H2 should be inside H1, H3 inside H2
      cy.validateDocumentSchema().then((result) => {
        expect(result.valid, `Schema violations: ${result.errors.join(', ')}`).to.be.true
      })

      // Verify H2 is nested inside H1
      cy.get('.docy_editor .heading[level="1"] .contentWrapper .heading[level="2"]').should('exist')
    })

    it('should handle mixed heading levels from external source', () => {
      cy.createDocument([section('Section', [paragraph('Content')])])
      cy.wait(100)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      pasteHtml(`
        <h2>Chapter 1</h2>
        <p>Introduction text</p>
        <h3>Section 1.1</h3>
        <p>Section content</p>
      `)

      cy.get('.docy_editor').should('contain', 'Chapter')

      // Validate schema
      cy.validateDocumentSchema().then((result) => {
        expect(result.valid, `Schema violations: ${result.errors.join(', ')}`).to.be.true
      })

      // Verify proper nesting
      cy.get('.docy_editor .heading[level="1"] .contentWrapper .heading[level="2"]').should('exist')
      cy.get('.docy_editor .heading[level="2"] .contentWrapper .heading[level="3"]').should('exist')
    })
  })

  describe('Rich Text from Apps', () => {
    it('should paste Google Docs style HTML', () => {
      cy.createDocument([section('Section', [paragraph('Content')])])
      cy.wait(100)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      pasteHtml(`
        <span style="font-weight:700">Bold text</span>
        <span style="font-style:italic">Italic text</span>
        <p>Normal paragraph from Google Docs</p>
      `)

      cy.get('.docy_editor').should('contain', 'Bold text')
    })

    it('should paste Word/Office HTML', () => {
      cy.createDocument([section('Section', [paragraph('Content')])])
      cy.wait(100)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      pasteHtml(`
        <p class="MsoNormal">
          <b><span style="font-size:14.0pt">Word Heading</span></b>
        </p>
        <p class="MsoNormal">Word paragraph content.</p>
      `)

      cy.get('.docy_editor').should('contain', 'Word')
    })
  })

  describe('Lists and Structured Content', () => {
    it('should paste bullet lists', () => {
      cy.createDocument([section('Section', [paragraph('Content')])])
      cy.wait(100)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      pasteHtml(`
        <ul>
          <li>First item</li>
          <li>Second item</li>
          <li>Third item</li>
        </ul>
      `)

      cy.get('.docy_editor').should('contain', 'First item')
    })

    it('should paste numbered lists', () => {
      cy.createDocument([section('Section', [paragraph('Content')])])
      cy.wait(100)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      pasteHtml(`
        <ol>
          <li>Step one</li>
          <li>Step two</li>
        </ol>
      `)

      cy.get('.docy_editor').should('contain', 'Step one')
    })
  })

  describe('Formatted Text', () => {
    it('should preserve bold and italic formatting', () => {
      cy.createDocument([section('Section', [paragraph('Content')])])
      cy.wait(100)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      pasteHtml(`
        <p>This has <b>bold</b> and <i>italic</i> text.</p>
      `)

      cy.get('.docy_editor').should('contain', 'bold')
    })

    it('should preserve links', () => {
      cy.createDocument([section('Section', [paragraph('Content')])])
      cy.wait(100)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      pasteHtml(`
        <p>Check out <a href="https://example.com">this link</a> for more.</p>
      `)

      cy.get('.docy_editor').should('contain', 'this link')
    })
  })

  // ==========================================================================
  // Real-World External HTML: minimax.io blog post pattern
  // Stress test: H1 + 12x H3 + divs + bold + lists + links + br
  // ==========================================================================

  /**
   * Trimmed minimax.io HTML preserving critical structural elements:
   * 1x <h1>, 12x <h3>, <div> wrappers, <p>, <strong>, <ul>/<li>,
   * <a href>, <br>, <img>. Stripped srcset/inline-style noise.
   * Source: https://www.minimax.io/news/minimax-m25
   */
  const MINIMAX_HTML = [
    '<div class="content-wrapper">',
    '  <div class="date-wrapper"><div class="date">2026.2.12</div></div>',
    '  <h1 class="title">MiniMax M2.5: Built for Real-World Productivity.</h1>',
    '  <div class="buttons">',
    '    <a href="https://platform.minimax.io/docs"><p>Access API</p></a>',
    '    <a href="https://platform.minimax.io/subscribe"><p>Coding Plan</p></a>',
    '  </div>',
    '  <div class="intro">',
    "    <br>Today we're introducing our latest model, <strong>MiniMax-M2.5.</strong>",
    '    <br><br>Extensively trained with reinforcement learning, M2.5 is',
    '    <strong>SOTA in coding, agentic tool use and search</strong>, boasting',
    '    scores of <strong>80.2% in SWE-Bench Verified</strong>.',
    '    <br><br>',
    '  </div>',
    '  <h3>Coding</h3>',
    '  <div><p>In programming evaluations, MiniMax-M2.5 saw substantial improvements.</p></div>',
    '  <div>',
    "    <br>We focused on the model's ability to generalize.",
    '    <ul>',
    '      <li>On Droid: 79.7(M2.5) &gt; 78.9(Opus 4.6)</li>',
    '      <li>On OpenCode: 76.1(M2.5) &gt; 75.9(Opus 4.6)</li>',
    '    </ul><br>',
    '  </div>',
    '  <h3>Search and Tool calling</h3>',
    '  <div><p>Effective tool calling and search are prerequisites for autonomy.</p></div>',
    '  <h3>Office work</h3>',
    '  <div>M2.5 was trained to produce truly deliverable outputs in office scenarios.</div>',
    '  <h3>Efficiency</h3>',
    '  <div>Task completion speed is a practical necessity. M2.5 is served at 100 tokens per second.</div>',
    '  <h3>Cost</h3>',
    '  <div>It costs just <strong>$1 to run the model continuously for an hour</strong>.</div>',
    '  <h3>Improvement Rate</h3>',
    '  <div>Over three and a half months, we released M2, M2.1, and M2.5.</div>',
    '  <h3>RL Scaling</h3>',
    '  <div>One of the key drivers is the scaling of reinforcement learning.</div>',
    '  <h3>Forge - Agent-Native RL Framework</h3>',
    '  <div>We designed an agent-native RL framework in-house, called Forge.</div>',
    '  <h3>Agentic RL Algorithm and Reward Design</h3>',
    '  <div>On the algorithm side, we continued using the CISPO algorithm.</div>',
    '  <h3>MiniMax Agent: M2.5 as a Professional Employee</h3>',
    '  <div>M2.5 has been fully deployed in MiniMax Agent.</div>',
    '  <h3>Appendix</h3>',
    '  <div>Further benchmark results of M2.5:</div>',
    '  <h3>Evaluation methods:</h3>',
    '  <div>',
    '    <ul>',
    '      <li><strong>SWE benchmark:</strong> SWE-bench Verified tested on internal infrastructure.</li>',
    '      <li><strong>BrowseComp:</strong> Uses the same agent framework as WebExplorer.</li>',
    '      <li><strong>RISE:</strong> Internal benchmark with real questions from experts.</li>',
    '    </ul>',
    '  </div>',
    '</div>'
  ].join('\n')

  const getHeadingCount = () => {
    return cy.window().then((win) => {
      const editor = win._editor
      if (!editor) return 0
      let count = 0
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'heading') count++
      })
      return count
    })
  }

  describe('Real-World HTML: minimax.io blog post (H1 + 12x H3)', () => {
    it('select-all + paste produces valid heading tree', () => {
      cy.createDocument([section('Old Section', [paragraph('old content')])])

      // CMD+A → paste
      cy.get('.docy_editor > .tiptap.ProseMirror').click({ force: true })
      cy.realPress(['Meta', 'a'])
      cy.wait(100)

      pasteHtml(MINIMAX_HTML)
      cy.wait(300)

      // Root H1 should exist
      cy.get('.docy_editor .heading[level="1"]').should('exist')
      cy.get('.docy_editor').should('contain', 'MiniMax M2.5')

      // H3 children should be nested inside H1
      cy.get('.docy_editor .heading[level="3"]').should('have.length.at.least', 10)

      cy.validateDocumentSchema().then((result) => {
        expect(result.valid, `HN-10 errors: ${result.errors.join(', ')}`).to.be.true
      })
    })

    it('double select-all + paste produces identical valid structure', () => {
      cy.createDocument([section('Initial', [paragraph('initial body')])])

      // ── FIRST CYCLE: CMD+A → paste ──
      cy.get('.docy_editor > .tiptap.ProseMirror').click({ force: true })
      cy.realPress(['Meta', 'a'])
      cy.wait(100)

      pasteHtml(MINIMAX_HTML)
      cy.wait(300)

      cy.get('.docy_editor .heading[level="1"]').should('exist')
      cy.get('.docy_editor').should('contain', 'MiniMax M2.5')

      cy.validateDocumentSchema().then((result) => {
        expect(result.valid, `HN-10 errors after first paste: ${result.errors.join(', ')}`).to.be
          .true
      })

      // Record heading count after first paste
      let firstPasteCount = 0
      getHeadingCount().then((count) => {
        firstPasteCount = count
      })

      // ── SECOND CYCLE: CMD+A → paste again ──
      cy.get('.docy_editor > .tiptap.ProseMirror').click({ force: true })
      cy.realPress(['Meta', 'a'])
      cy.wait(100)

      pasteHtml(MINIMAX_HTML)
      cy.wait(300)

      cy.get('.docy_editor .heading[level="1"]').should('exist')
      cy.get('.docy_editor').should('contain', 'MiniMax M2.5')

      cy.validateDocumentSchema().then((result) => {
        expect(result.valid, `HN-10 errors after second paste: ${result.errors.join(', ')}`).to.be
          .true
      })

      // Heading count should match between pastes
      getHeadingCount().then((count) => {
        expect(count).to.equal(firstPasteCount)
      })
    })

    it('select-all + paste then undo restores original document', () => {
      cy.createDocument([section('Undoable Section', [paragraph('Undoable content')])])

      // CMD+A + paste
      cy.get('.docy_editor > .tiptap.ProseMirror').click({ force: true })
      cy.realPress(['Meta', 'a'])
      cy.wait(100)

      pasteHtml(MINIMAX_HTML)
      cy.wait(300)

      cy.get('.docy_editor').should('contain', 'MiniMax M2.5')

      // Undo should restore original
      cy.realPress(['Meta', 'z'])
      cy.wait(100)

      cy.get('.docy_editor .heading[level="1"]').should('exist')

      cy.validateDocumentSchema().then((result) => {
        expect(result.valid, `HN-10 errors after undo: ${result.errors.join(', ')}`).to.be.true
      })
    })

    it('paste into contentWrapper produces valid heading tree', () => {
      cy.createDocument([section('Existing Section', [paragraph('Existing content')])])
      cy.wait(100)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      pasteHtml(MINIMAX_HTML)
      cy.wait(300)

      cy.get('.docy_editor').should('contain', 'MiniMax M2.5')

      cy.validateDocumentSchema().then((result) => {
        expect(result.valid, `Schema violations: ${result.errors.join(', ')}`).to.be.true
      })
    })

    it('H1 title appears BEFORE its H3 children when pasted into a section (ordering fix)', () => {
      cy.createDocument([section('Empty Section', [paragraph('')])])
      cy.wait(100)

      // Click into the empty paragraph inside the contentWrapper
      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.wait(100)

      pasteHtml(MINIMAX_HTML)
      cy.wait(300)

      // The H1 "MiniMax M2.5" must exist
      cy.get('.docy_editor').should('contain', 'MiniMax M2.5')

      // Verify ordering: H1 "MiniMax M2.5" appears BEFORE H3 "Coding" in the DOM
      cy.window().then((win) => {
        const editor = win._editor
        expect(editor, 'editor should exist').to.exist

        const doc = editor.state.doc
        let minimaxPos = -1
        let codingPos = -1

        doc.descendants((node, pos) => {
          if (node.type.name === 'contentHeading') {
            const text = node.textContent || ''
            if (text.includes('MiniMax M2.5') && minimaxPos === -1) {
              minimaxPos = pos
            }
            if (text.includes('Coding') && codingPos === -1) {
              codingPos = pos
            }
          }
        })

        expect(minimaxPos, 'MiniMax H1 should be found').to.be.greaterThan(-1)
        expect(codingPos, 'Coding H3 should be found').to.be.greaterThan(-1)
        expect(minimaxPos, 'H1 "MiniMax M2.5" must come BEFORE H3 "Coding"').to.be.lessThan(
          codingPos
        )

        // Verify H3 children are nested inside the H1's contentWrapper —
        // walk up from minimaxPos to find the parent heading, then check its CW
        let hasNestedH3 = false
        doc.descendants((node) => {
          if (
            node.type.name === 'heading' &&
            node.attrs.level === 1 &&
            node.firstChild?.textContent?.includes('MiniMax M2.5')
          ) {
            const cw = node.child(1)
            cw.descendants((child) => {
              if (child.type.name === 'heading') hasNestedH3 = true
            })
          }
        })
        expect(hasNestedH3, 'H3 children should be nested in H1 contentWrapper').to.be.true
      })

      cy.validateDocumentSchema().then((result) => {
        expect(result.valid, `HN-10 violations: ${result.errors.join(', ')}`).to.be.true
      })
    })

    it('preserves bold formatting and text content from external HTML', () => {
      cy.createDocument([section('Old', [paragraph('old')])])

      cy.get('.docy_editor > .tiptap.ProseMirror').click({ force: true })
      cy.realPress(['Meta', 'a'])
      cy.wait(100)

      pasteHtml(MINIMAX_HTML)
      cy.wait(300)

      // Bold marks from <strong> tags should be preserved
      cy.get('.docy_editor').should('contain', 'MiniMax-M2.5.')
      cy.get('.docy_editor').should('contain', 'Coding')
      cy.get('.docy_editor').should('contain', 'Search and Tool calling')
      cy.get('.docy_editor').should('contain', 'Evaluation methods')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty paste', () => {
      cy.createDocument([section('Section', [paragraph('Original')])])
      cy.wait(100)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.wait(100)

      pasteHtml('')

      cy.get('.docy_editor').should('contain', 'Original')
    })

    it('should handle emoji and unicode', () => {
      cy.createDocument([section('Section', [paragraph('Content')])])
      cy.wait(100)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      pasteHtml('<p>🎉 Celebration! 中文</p>')

      cy.get('.docy_editor').should('contain', '🎉')
    })

    it('should paste plain text without creating rich-text marks', () => {
      cy.createDocument([section('Section', [paragraph('Original content')])])
      cy.wait(100)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      pastePlainText('plain text clipboard payload only')

      cy.get('.docy_editor').should('contain', 'plain text clipboard payload only')
      cy.get('.docy_editor .heading[level="1"] .contentWrapper p')
        .find('strong')
        .should('not.exist')
      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').find('em').should('not.exist')
      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').find('a').should('not.exist')
      cy.assertFullSchemaValid()
    })

    it('should handle transformPastedHTML (div to span conversion)', () => {
      cy.createDocument([section('Section', [paragraph('Content')])])
      cy.wait(100)

      cy.get('.docy_editor .heading[level="1"] .contentWrapper p').first().click()
      cy.realPress('End')
      cy.wait(100)

      // Paste paragraphs with inline divs - divs get converted to spans
      pasteHtml(`
        <p>Text with <div style="display:inline">inline div</div> inside</p>
      `)

      // Content should be pasted
      cy.get('.docy_editor').should('contain', 'Text with')
    })
  })
})
