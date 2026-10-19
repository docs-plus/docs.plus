/// <reference types="cypress" />

import type { Editor, JSONContent } from '@tiptap/core'
import { closeHistory, redo, undo } from '@tiptap/pm/history'

// Failure modes: a block that stops being a mermaid block keeps its diagram, head or renderer;
// undo or redo leaves a stale diagram type; real typing or select-all loses a byte or a diagram;
// the caret skips the source; a read-only toggle rebuilds or refolds a block; a removed block
// draws late; a hidden block draws at zero width; far blocks never draw; Copy sends a stale or
// altered source; a whole-document replace with the same source redraws the diagram.

const ROOT = '.mermaid-diagram'
const VIEW = '.mermaid-diagram > [data-state]'
const MOD = Cypress.platform === 'darwin' ? 'Meta' : 'Control'

const FLOW = 'flowchart LR\n  Plan[Plan step] --> Build[Build step]'
const SEQ = 'sequenceDiagram\n  Alice->>Bob: Ping message'
const PIE = 'pie title Pets\n  "Dogs" : 40\n  "Cats" : 60'
const GIT = 'gitGraph\n  commit\n  branch feature\n  commit\n  checkout main\n  merge feature'
const THREE_LINES = 'flowchart TD\n  A[First line] --> B[Second]\n  B --> C[Third line here]'

const text = (value: string): JSONContent[] => (value ? [{ type: 'text', text: value }] : [])
const para = (value: string): JSONContent => ({ type: 'paragraph', content: text(value) })
const code = (source: string, language = 'mermaid'): JSONContent => ({
  type: 'codeBlock',
  attrs: { language },
  content: text(source)
})
const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content })

function setDoc(content: JSONContent): void {
  cy.getEditor().then((editor) => {
    editor.commands.setContent(content)
  })
}

function mermaidRanges(editor: Editor): { pos: number; from: number; to: number }[] {
  const ranges: { pos: number; from: number; to: number }[] = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'codeBlock' && node.attrs.language === 'mermaid') {
      ranges.push({ pos, from: pos + 1, to: pos + node.nodeSize - 1 })
    }
    return true
  })
  return ranges
}

function firstCodeBlock(editor: Editor): number {
  let found = -1
  editor.state.doc.descendants((node, pos) => {
    if (found < 0 && node.type.name === 'codeBlock') found = pos
    return found < 0
  })
  return found
}

function mermaidSources(editor: Editor): string[] {
  const sources: string[] = []
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'codeBlock' && node.attrs.language === 'mermaid') {
      sources.push(node.textContent)
    }
    return true
  })
  return sources
}

// History merges steps that land within 500 ms. Closing it keeps each test step its own undo.
function closeHistoryNow(editor: Editor): void {
  editor.view.dispatch(closeHistory(editor.state.tr))
}

// Changes one block's text in place, so its node view takes the update path.
function replaceSource(index: number, source: string): void {
  cy.getEditor().then((editor) => {
    closeHistoryNow(editor)
    const { from, to } = mermaidRanges(editor)[index]
    editor
      .chain()
      .command(({ tr }) => {
        tr.replaceWith(from, to, editor.schema.text(source))
        return true
      })
      .setTextSelection(from + source.length)
      .run()
  })
}

function expectState(index: number, state: string, timeout = 6000): void {
  cy.get(ROOT).eq(index).scrollIntoView()
  cy.get(VIEW, { timeout }).eq(index).should('have.attr', 'data-state', state)
}

function caretLine(editor: Editor): { parent: string; language: unknown; line: number } {
  const { $from } = editor.state.selection
  const before = $from.parent.textContent.slice(0, $from.parentOffset)
  return {
    parent: $from.parent.type.name,
    language: $from.parent.attrs.language,
    line: before.split('\n').length - 1
  }
}

function setEditorHidden(hidden: boolean): void {
  cy.window().then((win) => {
    win.document.getElementById('editor')!.style.display = hidden ? 'none' : ''
  })
}

describe('mermaid — editing edge cases', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
    cy.visitPlayground()
  })

  it('drops the diagram and head when the language changes, and draws again when switched back', () => {
    setDoc(doc(para('Intro'), code(FLOW), para('After')))
    expectState(0, 'ready')

    let oldRoot: HTMLElement
    let oldDiagram: HTMLElement
    cy.get(ROOT).then(($root) => {
      oldRoot = $root[0]
      oldDiagram = $root[0].querySelector('.mermaid-diagram__diagram')!
    })

    const setLanguage = (language: string): void => {
      cy.getEditor().then((editor) => {
        editor
          .chain()
          .setTextSelection(firstCodeBlock(editor) + 1)
          .updateAttributes('codeBlock', { language })
          .run()
      })
    }

    setLanguage('js')
    cy.get(ROOT).should('not.exist')
    cy.get('#editor')
      .find('svg, .mermaid-diagram__head, .mermaid-diagram__preview')
      .should('not.exist')
    cy.get('#editor pre code.language-js').should('have.text', FLOW)
    cy.then(() => {
      expect(oldRoot.isConnected).to.equal(false)
      // The renderer must let go of Pele's mount, or its listeners outlive the block.
      expect(oldDiagram.childNodes).to.have.length(0)
    })

    setLanguage('mermaid')
    expectState(0, 'ready')
    cy.get(`${VIEW} svg.pele.pele-flowchart`).should('contain.text', 'Plan step')
    cy.get(ROOT).should(($root) => expect($root[0]).to.not.equal(oldRoot))

    // The node view refuses any other spelling at build time, so nothing async can draw later.
    setLanguage('Mermaid')
    cy.get('#editor pre code.language-Mermaid').should('have.text', FLOW)
    cy.get(ROOT).should('not.exist')
    cy.get('#editor svg').should('not.exist')
  })

  it('tears the node view down when the block becomes a paragraph, and redraws on undo', () => {
    setDoc(doc(para('Intro'), code(FLOW), para('After')))
    expectState(0, 'ready')

    const convertAndUndo = (convert: (editor: Editor) => boolean): void => {
      let oldDiagram: HTMLElement
      cy.get(`${ROOT} .mermaid-diagram__diagram`).then(($diagram) => {
        oldDiagram = $diagram[0]
      })
      cy.getEditor().then((editor) => {
        closeHistoryNow(editor)
        editor.commands.setTextSelection(mermaidRanges(editor)[0].from + 3)
        expect(convert(editor)).to.equal(true)
      })
      cy.getEditor().should((editor) => {
        expect(mermaidSources(editor)).to.deep.equal([])
        expect(editor.state.doc.child(1).type.name).to.equal('paragraph')
      })
      cy.get(ROOT).should('not.exist')
      cy.get('#editor svg').should('not.exist')
      cy.then(() => expect(oldDiagram.childNodes).to.have.length(0))

      cy.getEditor().then((editor) => {
        expect(undo(editor.state, editor.view.dispatch)).to.equal(true)
        expect(mermaidSources(editor)).to.deep.equal([FLOW])
      })
      expectState(0, 'ready')
      cy.get(`${VIEW} svg.pele-flowchart`)
        .should('have.length', 1)
        .and('contain.text', 'Build step')
    }

    convertAndUndo((editor) => editor.commands.setNode('paragraph'))
    convertAndUndo((editor) => editor.commands.toggleNode('codeBlock', 'paragraph'))
  })

  // Tab is not typed: the code block leaves Tab to the browser unless `enableTabIndentation` is on.
  it('draws a diagram typed with real keys into an empty block, byte for byte', () => {
    const lines = [
      'flowchart TD',
      '  Draft[Write draft] --> Review[Peer review]',
      '  Review -->|yes| Ship[Ship it]'
    ]
    const typed = lines.join('\n')
    setDoc(doc(para('Intro'), code(''), para('After')))
    expectState(0, 'empty')
    cy.getEditor().then((editor) => {
      editor.chain().focus().setTextSelection(mermaidRanges(editor)[0].from).run()
    })
    cy.get('.ProseMirror').should('have.focus')
    cy.realType(lines.join('{enter}'))

    cy.getEditor().should((editor) => {
      expect(mermaidSources(editor)).to.deep.equal([typed])
      expect(editor.state.doc.childCount).to.equal(3)
    })
    expectState(0, 'ready')
    cy.get(`${VIEW} svg.pele.pele-flowchart`).should(($svg) => {
      for (const label of ['Write draft', 'Peer review', 'Ship it', 'yes']) {
        expect($svg.text()).to.include(label)
      }
    })
    cy.get(`${ROOT} .mermaid-diagram__source pre`).should('have.text', typed)
    cy.get('.mermaid-diagram__summary').should('have.text', 'Mermaid source · 3 lines hidden')
  })

  it('follows undo and redo across diagram type changes', () => {
    setDoc(doc(para('Intro'), code(FLOW), para('After')))
    expectState(0, 'ready')
    let root: HTMLElement
    cy.get(ROOT).then(($root) => {
      root = $root[0]
    })

    const TYPES = ['flowchart', 'sequence', 'pie']
    const expectType = (type: string, source: string): void => {
      cy.get(`${ROOT} .mermaid-diagram__source pre`).should('have.text', source)
      cy.get(`${VIEW} svg.pele`).should(($svg) => {
        expect($svg).to.have.length(1)
        for (const other of TYPES) {
          expect($svg.hasClass(`pele-${other}`), `pele-${other}`).to.equal(other === type)
        }
      })
      expectState(0, 'ready')
    }
    const step = (command: typeof undo): void => {
      cy.getEditor().then((editor) => {
        expect(command(editor.state, editor.view.dispatch)).to.equal(true)
      })
    }

    replaceSource(0, SEQ)
    expectType('sequence', SEQ)
    replaceSource(0, PIE)
    expectType('pie', PIE)

    step(undo)
    expectType('sequence', SEQ)
    step(undo)
    expectType('flowchart', FLOW)
    step(redo)
    expectType('sequence', SEQ)
    step(redo)
    expectType('pie', PIE)
    step(undo)
    step(undo)
    expectType('flowchart', FLOW)
    step(redo)
    expectType('sequence', SEQ)
    cy.then(() => expect(root.isConnected).to.equal(true))
  })

  it('empties the editor on a real select-all and Backspace, and undo redraws every diagram', () => {
    setDoc(doc(code(FLOW), para('Between'), code(SEQ), para('End')))
    expectState(0, 'ready')
    expectState(1, 'ready')
    cy.getEditor().then((editor) => {
      closeHistoryNow(editor)
      editor.commands.focus('end')
    })
    cy.get('.ProseMirror').should('have.focus')
    cy.realPress([MOD, 'a'])
    cy.getEditor().its('state.selection.empty').should('equal', false)
    cy.realPress('Backspace')

    cy.getEditor().should((editor) => {
      expect(editor.isEmpty).to.equal(true)
      expect(editor.state.doc.childCount).to.equal(1)
      expect(editor.state.doc.firstChild!.type.name).to.equal('paragraph')
    })
    cy.get(ROOT).should('not.exist')
    cy.get('#editor svg').should('not.exist')

    cy.get('.ProseMirror').should('have.focus')
    cy.realPress([MOD, 'z'])
    cy.getEditor().should((editor) => {
      expect(mermaidSources(editor)).to.deep.equal([FLOW, SEQ])
    })
    expectState(0, 'ready')
    expectState(1, 'ready')
    cy.get(VIEW).eq(0).find('svg.pele-flowchart').should('contain.text', 'Plan step')
    cy.get(VIEW).eq(1).find('svg.pele-sequence').should('contain.text', 'Ping message')
  })

  // An open block leaves arrows to the browser (only a folded one is stepped by hand). The caret
  // must still pass over the head and the drawn preview and land in the source.
  it('moves the caret into and out of the source with real arrow keys', () => {
    for (const query of ['', '?bare']) {
      cy.visitPlayground(query)
      setDoc(doc(para('Above'), code(THREE_LINES), para('Below')))
      expectState(0, 'ready')
      cy.get(ROOT).should('have.attr', 'data-source', 'open')
      cy.get('.mermaid-diagram__head').should(query ? 'not.exist' : 'exist')

      cy.getEditor().then((editor) => {
        editor.chain().focus().setTextSelection(6).run()
      })
      cy.get('.ProseMirror').should('have.focus')
      cy.realPress('ArrowDown')
      cy.getEditor().should((editor) => {
        expect(caretLine(editor)).to.deep.equal({
          parent: 'codeBlock',
          language: 'mermaid',
          line: 0
        })
      })

      cy.getEditor().then((editor) => {
        editor
          .chain()
          .focus()
          .setTextSelection(editor.state.doc.content.size - 3)
          .run()
      })
      cy.get('.ProseMirror').should('have.focus')
      cy.realPress('ArrowUp')
      cy.getEditor().should((editor) => {
        expect(caretLine(editor)).to.deep.equal({
          parent: 'codeBlock',
          language: 'mermaid',
          line: 2
        })
      })

      cy.realPress('ArrowDown')
      cy.getEditor().should((editor) => {
        expect(editor.state.selection.$from.parent.textContent).to.equal('Below')
      })

      // From the very end, Tiptap's own code block ArrowDown moves the caret to the next block.
      cy.realPress('ArrowUp')
      cy.realPress('End')
      cy.getEditor().should((editor) => {
        const { $from } = editor.state.selection
        expect($from.parent.type.name).to.equal('codeBlock')
        expect($from.parentOffset).to.equal(THREE_LINES.length)
      })
      cy.realPress('ArrowDown')
      cy.getEditor().should((editor) => {
        const { $from } = editor.state.selection
        expect($from.parent.textContent).to.equal('Below')
        expect($from.parentOffset).to.equal(0)
        expect(mermaidSources(editor)).to.deep.equal([THREE_LINES])
      })
      cy.get(ROOT).should('have.attr', 'data-source', 'open')
    }
  })

  // The fold start state is read once, when a block is built. A runtime toggle neither rebuilds
  // nor refolds a block that already exists, so the drawn SVG survives both ways.
  it('keeps the head, the fold and the drawn SVG through a runtime read-only toggle', () => {
    setDoc(doc(para('Above'), code(FLOW), para('Below')))
    expectState(0, 'ready')
    let root: HTMLElement
    let svg: SVGElement
    cy.get(ROOT).then(($root) => {
      root = $root[0]
      svg = $root[0].querySelector('svg.pele')!
    })

    cy.getEditor().then((editor) => editor.setEditable(false))
    cy.get('.ProseMirror').should('have.attr', 'contenteditable', 'false')
    cy.get(ROOT).should(($root) => {
      expect($root[0]).to.equal(root)
      expect($root.attr('data-source')).to.equal('open')
      expect($root.find('.mermaid-diagram__head .mermaid-diagram__fold')).to.have.length(1)
      expect($root.find('svg.pele')[0]).to.equal(svg)
    })
    expectState(0, 'ready')

    // Only the new second block is built while read-only, so only it starts folded.
    setDoc(doc(para('Above'), code(FLOW), para('Middle'), code(SEQ), para('Below')))
    expectState(1, 'ready')
    cy.get(ROOT).eq(0).should('have.attr', 'data-source', 'open')
    cy.get(ROOT).eq(1).should('have.attr', 'data-source', 'folded')

    cy.getEditor().then((editor) => editor.setEditable(true))
    cy.get('.ProseMirror').should('have.attr', 'contenteditable', 'true')
    cy.get(ROOT).eq(0).should('have.attr', 'data-source', 'open')
    cy.get(ROOT).eq(1).should('have.attr', 'data-source', 'folded')
    cy.get(ROOT)
      .eq(0)
      .should(($root) => {
        expect($root[0]).to.equal(root)
        expect($root.find('svg.pele')[0]).to.equal(svg)
      })
    expectState(0, 'ready')
    expectState(1, 'ready')
  })

  it('drops the draw of a block removed while its diagram type loads, then draws it again', () => {
    const uncaught: string[] = []
    cy.on('uncaught:exception', (err) => {
      uncaught.push(err.message)
      return false
    })
    cy.window().then((win) => {
      cy.spy(win.console, 'error').as('consoleError')
    })

    // Same tick: the block is gone before it is ever visible, so no draw starts.
    cy.getEditor().then((editor) => {
      editor.commands.setContent(doc(code(GIT), para('After')))
      editor.commands.setContent(doc(para('Gone')))
    })
    cy.get(ROOT).should('not.exist')

    // In flight: the first visibility hit starts the draw, which then waits on the gitGraph
    // load. Removing the block right after that hit destroys it before `ready`.
    let detached: HTMLElement | undefined
    let atRemoval: { state?: string; svg: number } | undefined
    cy.window().then((win) => {
      const Native = win.IntersectionObserver
      win.IntersectionObserver = class extends Native {
        constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
          super((records, observer) => {
            callback(records, observer)
            if (detached || !records.some((record) => record.isIntersecting)) return
            const view = win.document.querySelector<HTMLElement>(VIEW)!
            detached = view.querySelector<HTMLElement>('.mermaid-diagram__diagram')!
            atRemoval = { state: view.dataset.state, svg: view.querySelectorAll('svg').length }
            win._editor.commands.setContent(doc(para('Removed')))
          }, options)
        }
      }
    })
    setDoc(doc(code(GIT), para('After')))
    cy.get('#editor').should('contain.text', 'Removed')
    cy.get(ROOT).should('not.exist')
    cy.then(() => expect(atRemoval).to.deep.equal({ state: 'loading', svg: 0 }))

    setDoc(doc(para('Again'), code(GIT), para('After')))
    expectState(0, 'ready')
    cy.get('svg.pele').should('have.length', 1).and('have.class', 'pele-gitGraph')
    cy.get(ROOT).should('have.length', 1)
    cy.then(() => {
      expect(detached!.isConnected).to.equal(false)
      expect(detached!.childNodes).to.have.length(0)
      expect(uncaught).to.deep.equal([])
    })
    cy.get('@consoleError').should('not.have.been.called')
  })

  // A hidden block never intersects, so it waits. An edit while hidden takes the zero-width
  // path in the renderer, which must remount rather than skip the draw.
  it('draws a hidden block once shown, at the width a visible draw gets, and fits a narrow window', () => {
    const edited = THREE_LINES + '\n  C --> D[Fourth]'
    setEditorHidden(true)
    setDoc(doc(code(THREE_LINES), para('After')))
    // Nothing can wake a hidden block, so a fixed wait is the only way to show it stays idle.
    cy.wait(1000)
    cy.get(VIEW).should('have.attr', 'data-state', 'loading').find('svg').should('not.exist')
    setEditorHidden(false)
    expectState(0, 'ready')
    cy.get(`${VIEW} svg.pele`).should(($svg) => {
      expect($svg[0].getBoundingClientRect().width).to.be.greaterThan(0)
    })

    setEditorHidden(true)
    replaceSource(0, edited)
    cy.get(`${VIEW} svg.pele`).should('contain.text', 'Fourth')
    setEditorHidden(false)
    let hiddenDraw: DOMRect
    cy.get(`${VIEW} svg.pele`).then(($svg) => {
      hiddenDraw = $svg[0].getBoundingClientRect()
      expect(hiddenDraw.width).to.be.greaterThan(0)
    })
    cy.getEditor().then((editor) => {
      editor.commands.insertContentAt(editor.state.doc.content.size, code(edited))
    })
    expectState(1, 'ready')
    cy.get(VIEW)
      .eq(1)
      .find('svg.pele')
      .should(($svg) => {
        const visibleDraw = $svg[0].getBoundingClientRect()
        expect(hiddenDraw.width).to.be.closeTo(visibleDraw.width, 1)
        expect(hiddenDraw.height).to.be.closeTo(visibleDraw.height, 1)
      })

    const WIDE =
      'sequenceDiagram\n' +
      ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel']
        .map((name, i, all) => `  ${name}->>${all[(i + 1) % all.length]}: Message from ${name}`)
        .join('\n')
    setDoc(doc(code(WIDE), para('After')))
    cy.get(`${VIEW} svg.pele-sequence`).should('contain.text', 'Message from Hotel')
    expectState(0, 'ready')
    let wideWidth: number
    cy.get(`${VIEW} svg.pele`).should(($svg) => {
      const box = $svg[0].closest('.mermaid-diagram__diagram')!.getBoundingClientRect()
      const svgBox = $svg[0].getBoundingClientRect()
      expect(svgBox.width)
        .to.be.greaterThan(0)
        .and.at.most(box.width + 0.5)
      wideWidth = svgBox.width
    })
    cy.viewport(500, 800)
    cy.get(`${VIEW} svg.pele`).should(($svg) => {
      const win = $svg[0].ownerDocument.defaultView!
      const svgBox = $svg[0].getBoundingClientRect()
      const box = $svg[0].closest('.mermaid-diagram__diagram')!.getBoundingClientRect()
      const editorBox = win.document.getElementById('editor')!.getBoundingClientRect()
      expect(svgBox.width).to.be.lessThan(wideWidth)
      expect(svgBox.left).to.be.at.least(box.left - 0.5)
      expect(svgBox.right).to.be.at.most(box.right + 0.5)
      expect(box.right).to.be.at.most(editorBox.right)
      expect(win.document.documentElement.scrollWidth).to.be.at.most(win.innerWidth)
    })
  })

  // Blocks draw only within 800px of the viewport. The far ones wait until the reader scrolls.
  it('draws all of 40 diagrams in one document as each scrolls near', () => {
    const COUNT = 40
    const sources = Array.from({ length: COUNT }, (_, i) => `flowchart LR\n  N${i}[Item ${i}]`)
    setDoc(doc(...sources.map((source) => code(source)), para('End')))
    cy.get(ROOT).should('have.length', COUNT)
    cy.get(VIEW).first().should('have.attr', 'data-state', 'ready')
    cy.get(VIEW).last().should('have.attr', 'data-state', 'loading').find('svg').should('not.exist')

    sources.forEach((_, index) => {
      expectState(index, 'ready', 20000)
      cy.get(VIEW).eq(index).find('svg.pele').should('contain.text', `Item ${index}`)
    })
    cy.get('#editor svg.pele').should('have.length', COUNT)
    cy.getEditor().should((editor) => expect(mermaidSources(editor)).to.deep.equal(sources))
  })

  // The head keeps its own copy of the source. It must follow edits, and the textarea fallback
  // for a refused clipboard must keep every byte too.
  it('copies the edited source byte for byte, through the clipboard and the fallback', () => {
    const UNICODE =
      'flowchart TD\n' +
      '  A["سلام دنیا 👋🏽"] -->|"日本語"| B["café e\u0301 👨‍👩‍👧"]\n' +
      '\t%% tab-led comment with trailing spaces   \n' +
      '  B --> C[Done]  '
    setDoc(doc(code(FLOW), para('Between'), code(SEQ), para('End')))
    expectState(0, 'ready')
    expectState(1, 'ready')
    replaceSource(0, UNICODE)
    replaceSource(1, UNICODE + '\n')
    cy.get(`${ROOT} .mermaid-diagram__source pre`)
      .eq(1)
      .should('have.text', UNICODE + '\n')

    cy.window().then((win) => {
      cy.stub(win.navigator.clipboard, 'writeText').as('writeText').resolves()
    })
    cy.get('.mermaid-diagram__copy').eq(0).focus().click()
    cy.get('@writeText').should('have.been.calledOnceWithExactly', UNICODE)

    let fallback: string | undefined
    cy.window().then((win) => {
      ;(win.navigator.clipboard.writeText as unknown as sinon.SinonStub).rejects(
        new Error('denied')
      )
      cy.stub(win.document, 'execCommand').callsFake(() => {
        fallback = win.document.querySelector<HTMLTextAreaElement>('textarea[readonly]')?.value
        return true
      })
    })
    cy.get('.mermaid-diagram__copy').eq(1).focus().click()
    cy.get('.mermaid-diagram__copy').eq(1).should('have.attr', 'aria-label', 'Copied')
    cy.then(() => expect(fallback).to.equal(UNICODE + '\n'))
    cy.get('textarea').should('not.exist')
  })

  // A collaborative or programmatic replace that keeps the diagram node equal must reuse its
  // node view. Every finished render writes `data-state`, so any write means a redraw ran.
  // Pele may still refit the viewBox to a new width; that is not a redraw.
  it('keeps the same drawn SVG when the whole document is replaced around an equal diagram', () => {
    setDoc(doc(para('Before v1'), code(FLOW), para('After v1')))
    expectState(0, 'ready')

    let root: HTMLElement
    let svg: SVGElement
    let renders = 0
    cy.get(ROOT).then(($root) => {
      root = $root[0]
      svg = root.querySelector('svg.pele')!
      new MutationObserver((records) => {
        renders += records.length
      }).observe(root.querySelector(':scope > [data-state]')!, {
        attributeFilter: ['data-state']
      })
    })

    const replacements = [
      doc(para('Before v2'), code(FLOW), para('After v2')),
      doc(para('New intro'), para('Before v3'), code(FLOW), para('After v3'), para('More')),
      doc(code(FLOW))
    ]
    for (const replacement of replacements) {
      setDoc(replacement)
      cy.getEditor().should((editor) => expect(mermaidSources(editor)).to.deep.equal([FLOW]))
      // A redraw starts 300 ms after a change, so wait past it before checking nothing moved.
      cy.wait(600)
      cy.get(ROOT).should(($root) => {
        expect($root[0]).to.equal(root)
        expect($root.find('svg.pele')[0]).to.equal(svg)
        expect(svg.isConnected).to.equal(true)
        expect(renders).to.equal(0)
      })
      expectState(0, 'ready')
    }
  })
})

export {}
