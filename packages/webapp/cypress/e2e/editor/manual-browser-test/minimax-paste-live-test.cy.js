describe('MiniMax Paste Live Test', () => {
  const MINIMAX_HTML =
    '<div>' +
    '<div>MiniMax</div>' +
    '<div>Login</div>' +
    '<div>API Platform | MiniMax Agent | Hailuo AI Video | MiniMax Audio</div>' +
    '<div>2026.2.12</div>' +
    '<h1>MiniMax M2.5: Built for Real-World Productivity.</h1>' +
    '<div>Today we are introducing our latest model, <strong>MiniMax-M2.5.</strong></div>' +
    '<div>Extensively trained with reinforcement learning in hundreds of thousands of complex real-world environments.</div>' +
    '<h3>Coding</h3>' +
    '<div><p>In programming evaluations, MiniMax-M2.5 saw substantial improvements.</p></div>' +
    '<h3>Search and Tool calling</h3>' +
    '<div><p>Effective tool calling and search are prerequisites for autonomy.</p></div>' +
    '<h3>Office work</h3>' +
    '<div>M2.5 was trained to produce truly deliverable outputs.</div>' +
    '<h3>Efficiency</h3>' +
    '<div>Task completion speed is a practical necessity.</div>' +
    '<h3>Cost</h3>' +
    '<div>It costs just <strong>$1 to run the model continuously for an hour</strong>.</div>' +
    '<h3>Improvement Rate</h3>' +
    '<div>Over three and a half months, we released M2, M2.1, and M2.5.</div>' +
    '<h3>RL Scaling</h3>' +
    '<div>One of the key drivers is the scaling of reinforcement learning.</div>' +
    '<h3>Forge</h3>' +
    '<div>We designed an agent-native RL framework.</div>' +
    '<h3>Agentic RL</h3>' +
    '<div>On the algorithm side, we continued using CISPO.</div>' +
    '<h3>MiniMax Agent</h3>' +
    '<div>M2.5 has been fully deployed in MiniMax Agent.</div>' +
    '<h3>Appendix</h3>' +
    '<div>Further benchmark results.</div>' +
    '<h3>Evaluation methods</h3>' +
    '<div><ul><li><strong>SWE benchmark:</strong> SWE-bench Verified.</li><li><strong>BrowseComp:</strong> WebExplorer framework.</li></ul></div>' +
    '<h6>Research</h6>' +
    '<ul><li>MiniMax M2.5</li><li>MiniMax M2</li></ul>' +
    '<h6>Product</h6>' +
    '<ul><li>Agent</li><li>Video Hailuo</li></ul>' +
    '<h6>API</h6>' +
    '<ul><li>Developer Docs</li><li>Pricing</li></ul>' +
    '<h6>Company</h6>' +
    '<ul><li>About Us</li></ul>' +
    '<h6>News</h6>' +
    '<ul><li>What is New</li></ul>' +
    '<div>© 2026 MiniMax</div>' +
    '</div>'

  let capturedErrors = []

  beforeEach(() => {
    capturedErrors = []

    // Capture uncaught exceptions
    cy.on('uncaught:exception', (err) => {
      capturedErrors.push({
        message: err.message,
        stack: err.stack,
        time: new Date().toISOString()
      })
      // Return false to prevent test from failing
      return false
    })

    cy.visit('http://localhost:3001/editor')

    // Wait for editor to be initialized
    cy.window().then((win) => {
      return new Cypress.Promise((resolve) => {
        const checkEditor = () => {
          if (win._editor && win._editor.commands) {
            resolve()
          } else {
            setTimeout(checkEditor, 100)
          }
        }
        checkEditor()
      })
    })

    cy.window().then((win) => {
      win._editor.commands.clearContent()
    })

    cy.wait(500)
  })

  function dispatchPaste(html) {
    cy.window().then((win) => {
      const editor = win._editor
      const clipboardData = new DataTransfer()
      clipboardData.setData('text/html', html)
      clipboardData.setData('text/plain', html.replace(/<[^>]*>/g, ' '))
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true
      })
      editor.view.dom.dispatchEvent(pasteEvent)
    })
  }

  function verifyHeadings(phase) {
    return cy.window().then((win) => {
      const editor = win._editor
      const doc = editor.state.doc
      const headings = []
      doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          const ch = node.firstChild
          const level = ch && ch.attrs ? ch.attrs.level : '?'
          const title = ch ? ch.textContent.substring(0, 50) : ''
          const depth = doc.resolve(pos).depth
          headings.push({ level, title, depth })
        }
      })
      return {
        phase,
        totalHeadings: headings.length,
        headings
      }
    })
  }

  it('Phase 1: Paste into contentHeading', () => {
    cy.log('Phase 1: Paste into contentHeading')

    // Place cursor in the first contentHeading title
    cy.window().then((win) => {
      const editor = win._editor
      const firstContentHeading = editor.state.doc.firstChild?.firstChild
      if (firstContentHeading) {
        editor.commands.setTextSelection(2)
      }
    })

    cy.wait(200)

    // Dispatch paste event
    dispatchPaste(MINIMAX_HTML)

    cy.wait(3000)

    // Log captured errors
    cy.then(() => {
      if (capturedErrors.length > 0) {
        cy.log('🚨 ERRORS CAPTURED:', JSON.stringify(capturedErrors, null, 2))
        console.log('🚨 PHASE 1 ERRORS:', JSON.stringify(capturedErrors, null, 2))
      } else {
        cy.log('✅ No errors captured')
        console.log('✅ PHASE 1: No errors')
      }
    })

    // Verify headings
    verifyHeadings('PHASE1').then((result) => {
      cy.log('Phase 1 Results:', JSON.stringify(result, null, 2))
      console.log('PHASE 1 RESULTS:', JSON.stringify(result, null, 2))

      // Report summary
      const summary = {
        phase: 'PHASE1',
        totalHeadings: result.totalHeadings,
        errorCount: capturedErrors.length,
        errors: capturedErrors,
        headings: result.headings
      }

      cy.log('=== PHASE 1 SUMMARY ===')
      cy.log(`Total Headings: ${result.totalHeadings}`)
      cy.log(`Errors: ${capturedErrors.length}`)
      if (capturedErrors.length > 0) {
        cy.log(`Error Messages: ${capturedErrors.map((e) => e.message).join(', ')}`)
      }

      // Write to file
      cy.writeFile('cypress/results/minimax-phase1-results.json', summary)
    })
  })

  it('Phase 2: Select All + Paste (crash scenario)', () => {
    cy.log('Phase 2: Select All + Paste')

    // First, paste some content
    cy.window().then((win) => {
      const editor = win._editor
      editor.commands.setTextSelection(2)
    })

    dispatchPaste(MINIMAX_HTML)
    cy.wait(2000)

    // Clear errors from Phase 1
    cy.then(() => {
      capturedErrors = []
    })

    // Now select all and paste again
    cy.window().then((win) => {
      const editor = win._editor
      editor.commands.selectAll()
    })

    cy.wait(200)

    // Dispatch paste event
    dispatchPaste(MINIMAX_HTML)

    cy.wait(3000)

    // Log captured errors
    cy.then(() => {
      if (capturedErrors.length > 0) {
        cy.log('🚨 ERRORS CAPTURED:', JSON.stringify(capturedErrors, null, 2))
        console.log('🚨 PHASE 2 ERRORS:', JSON.stringify(capturedErrors, null, 2))
      } else {
        cy.log('✅ No errors captured')
        console.log('✅ PHASE 2: No errors')
      }
    })

    // Verify headings
    verifyHeadings('PHASE2').then((result) => {
      cy.log('Phase 2 Results:', JSON.stringify(result, null, 2))
      console.log('PHASE 2 RESULTS:', JSON.stringify(result, null, 2))

      // Report summary
      const summary = {
        phase: 'PHASE2',
        totalHeadings: result.totalHeadings,
        errorCount: capturedErrors.length,
        errors: capturedErrors,
        headings: result.headings
      }

      cy.log('=== PHASE 2 SUMMARY ===')
      cy.log(`Total Headings: ${result.totalHeadings}`)
      cy.log(`Errors: ${capturedErrors.length}`)
      if (capturedErrors.length > 0) {
        cy.log(`Error Messages: ${capturedErrors.map((e) => e.message).join(', ')}`)
      }

      // Write to file
      cy.writeFile('cypress/results/minimax-phase2-results.json', summary)
    })
  })
})
