/// <reference types="cypress" />

// Failure modes: the head cannot be reached or named; a live region enters the editor;
// touch gets small hidden buttons or zoom; reduced motion still animates; a theme change
// redraws or misses the SVG; dark text loses contrast; zoom and caret keys leak; print
// shows the head or zoom, or the wrong half of a block; a runtime theme style rebuilds it.

const GOOD = 'flowchart LR\n  A[Write] --> B[See it]'
const BROKEN = GOOD + ' -->'
const PIE = 'pie\n  "Read": 3\n  "Write": 2'
// Wider than the 602px host, so Pele scales it down and turns zoom on.
const WIDE =
  'sequenceDiagram\n' +
  Array.from({ length: 12 }, (_, i) => `  participant P${i} as Participant number ${i}`).join(
    '\n'
  ) +
  '\n  P0->>P11: Hello there'
const VIEW = '.mermaid-diagram > [data-state]'
const LIVE = '[aria-live], [role=status], [role=alert], output'
// Nothing draws before first visibility, so a block below this much text stays loading.
const FILLER = '<p>Filler line</p>'.repeat(80)

function block(src: string): string {
  const text = src.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return '<pre><code class="language-mermaid">' + text + '</code></pre>'
}

function cdp(command: string, params: Record<string, unknown> = {}): void {
  cy.then(() => Cypress.automation('remote:debugger:protocol', { command, params }))
}

function expectReady(index = 0): void {
  cy.get(VIEW).eq(index).scrollIntoView().should('have.attr', 'data-state', 'ready')
}

function caretInParagraph(text: string, offset: number): void {
  cy.getEditor().then((editor) => {
    let at = -1
    editor.state.doc.descendants((node, pos) => {
      if (at < 0 && node.type.name === 'paragraph' && node.textContent === text) at = pos + 1
      return at < 0
    })
    editor
      .chain()
      .focus()
      .setTextSelection(at + offset)
      .run()
  })
  cy.get('.ProseMirror').should('have.focus')
}

function paragraphTexts(): Cypress.Chainable<string[]> {
  return cy.getEditor().then((editor) => {
    const texts: string[] = []
    editor.state.doc.forEach((node) => {
      if (node.type.name === 'paragraph') texts.push(node.textContent)
    })
    return texts
  })
}

// ResizeObserver work lands before the next paint, so two frames cover a late redraw.
function twoFrames(): void {
  cy.window().then(
    (win) =>
      new Cypress.Promise<void>((resolve) => {
        win.requestAnimationFrame(() => win.requestAnimationFrame(() => resolve()))
      })
  )
}

// A rule, not an inline style, so these cases stay on the stylesheet path.
function stylesheet(css: string): void {
  cy.document().then((doc) => {
    const style = doc.createElement('style')
    style.textContent = css
    doc.head.append(style)
  })
}

function luminance(color: string): number {
  const [r, g, b] = (color.match(/[\d.]+/g) ?? []).slice(0, 3).map((value) => {
    const c = Number(value) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(foreground: string, background: string): number {
  const [high, low] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (high + 0.05) / (low + 0.05)
}

describe('mermaid — accessibility, pointer, motion and theme edges', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
  })

  afterEach(() => {
    cdp('Emulation.setEmulatedMedia', { media: '', features: [] })
    cdp('Emulation.setTouchEmulationEnabled', { enabled: false })
  })

  // Real Tab presses, because a button inside the editable root can drop out of the tab
  // order. Gate on focus first: `realPress` is a parent command.
  it('reaches Syntax, Copy and Hide source with Tab, each named, and shows them on focus', () => {
    cy.visitPlayground()
    cy.setEditorContent('<p>Before</p>' + block(GOOD) + '<p>After</p>')
    expectReady()
    cy.get('.mermaid-diagram__actions').should('have.css', 'opacity', '0')
    cy.get('.mermaid-diagram__label').should('have.css', 'opacity', '1')
    caretInParagraph('Before', 3)

    const stops: [string, string][] = [
      ['mermaid-diagram__help', 'Mermaid syntax guide (opens in a new tab)'],
      ['mermaid-diagram__copy', 'Copy Mermaid source'],
      ['mermaid-diagram__fold', 'Hide source']
    ]
    for (const [className, name] of stops) {
      cy.realPress('Tab')
      cy.focused().should('have.class', className).and('have.attr', 'aria-label', name)
      cy.get('.mermaid-diagram__actions')
        .should('have.css', 'opacity', '1')
        .and('have.css', 'pointer-events', 'auto')
      cy.get('.mermaid-diagram__label').should('have.css', 'opacity', '0')
    }

    cy.realPress('Tab')
    cy.focused().should(($el) => {
      expect($el.closest('.mermaid-diagram')).to.have.length(0)
    })
    cy.get('.mermaid-diagram__actions').should('have.css', 'opacity', '0')
    cy.get('.mermaid-diagram__label').should('have.css', 'opacity', '1')
  })

  // An author title must win over the type name. The editor must never announce render
  // states on its own (see apps/webapp/src/components/TipTap/CLAUDE.md).
  it('names each diagram and the fold state, with no live region in any render state', () => {
    cy.visitPlayground()
    cy.setEditorContent(
      block('flowchart LR\n  accTitle: Build steps\n  accDescr: How a build runs\n  A --> B') +
        block(PIE) +
        block('classDiagram\n  class Animal\n  Animal <|-- Dog') +
        block('stateDiagram-v2\n  [*] --> Still\n  Still --> [*]') +
        block('') +
        block(BROKEN) +
        FILLER +
        block(GOOD) +
        '<p>After</p>'
    )
    for (const index of [0, 1, 2, 3]) expectReady(index)
    cy.get(VIEW).eq(4).should('have.attr', 'data-state', 'empty')
    cy.get(VIEW).eq(5).scrollIntoView().should('have.attr', 'data-state', 'error')
    cy.get(VIEW).eq(6).should('have.attr', 'data-state', 'loading')
    cy.get('.mermaid-diagram__diagram').eq(6).should('have.attr', 'aria-busy', 'true')

    cy.get(`${VIEW} svg.pele`).each(($svg) => {
      expect($svg.attr('role')).to.contain('graphics-document')
    })
    cy.get(`${VIEW} svg.pele-flowchart`).should('not.have.attr', 'aria-label')
    cy.get(`${VIEW} svg.pele-flowchart`)
      .invoke('attr', 'aria-labelledby')
      .then((id) => {
        cy.get(`[id="${id}"]`).should('have.text', 'Build steps')
      })
    cy.get(`${VIEW} svg.pele-pie`).should('have.attr', 'aria-label', 'pie diagram')
    cy.get(`${VIEW} svg.pele-class`).should('have.attr', 'aria-label', 'class diagram')
    cy.get(`${VIEW} svg.pele-state`).should('have.attr', 'aria-label', 'state diagram')
    cy.get('#editor').find(LIVE).should('not.exist')

    cy.get('.mermaid-diagram__fold')
      .first()
      .should('have.attr', 'aria-expanded', 'true')
      .and('have.attr', 'aria-label', 'Hide source')
      .focus()
      .click()
    cy.get('.mermaid-diagram__fold')
      .first()
      .should('have.attr', 'aria-expanded', 'false')
      .and('have.attr', 'aria-label', 'Show source')
    cy.get('.mermaid-diagram__summary').first().should('be.visible')
    cy.get('.mermaid-diagram__fold').first().focus().click()
    cy.get('.mermaid-diagram__fold').first().should('have.attr', 'aria-expanded', 'true')

    cy.get(VIEW).eq(6).scrollIntoView().should('have.attr', 'data-state', 'ready')
    cy.get('.mermaid-diagram__diagram').eq(6).should('not.have.attr', 'aria-busy')
    cy.get('#editor').find(LIVE).should('not.exist')
  })

  // The package ships 22px fine-pointer buttons; the docs.plus skin raises them to 28px.
  // Touch emulation flips both the CSS media query and the renderer's matchMedia read.
  it('uses 44px always-visible named buttons and no zoom on a coarse pointer', () => {
    const wideAndScaled = (): void => {
      cy.get(`${VIEW} svg.pele`).should(($svg) => {
        const host = $svg[0].parentElement!
        expect(Number($svg.attr('width'))).to.be.greaterThan(host.clientWidth)
      })
    }

    cy.visitPlayground()
    cy.setEditorContent(block(WIDE) + '<p>After</p>')
    expectReady()
    wideAndScaled()
    cy.get('.mermaid-diagram__head button').each(($button) => {
      expect($button[0].getBoundingClientRect().height).to.equal(22)
    })
    cy.get('.mermaid-diagram__head .mermaid-diagram__text').should(
      'not.have.css',
      'display',
      'none'
    )
    cy.get('.mermaid-diagram__diagram .pele-zoom').should('exist')
    cy.get('.pele-zoom-in').should('have.attr', 'aria-label', 'Zoom in')
    cy.get(`${VIEW} svg.pele`)
      .should('have.attr', 'tabindex', '0')
      .and('have.css', 'touch-action', 'pan-y')

    cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
    cy.visitPlayground()
    cy.window().then((win) => {
      expect(win.matchMedia('(pointer: coarse)').matches).to.equal(true)
    })
    cy.setEditorContent(block(WIDE) + '<p>After</p>')
    expectReady()
    wideAndScaled()
    cy.get('.mermaid-diagram__actions').should('have.css', 'opacity', '1')
    cy.get('.mermaid-diagram__label').should('have.css', 'display', 'none')
    cy.get('.mermaid-diagram__head button')
      .should('have.length', 3)
      .each(($button) => {
        const box = $button[0].getBoundingClientRect()
        expect(box.height).to.equal(44)
        expect(box.width).to.be.at.least(44)
        expect($button.attr('aria-label')).to.have.length.greaterThan(0)
        expect($button.find('.mermaid-diagram__text').css('display')).to.equal('none')
      })
    cy.get('.mermaid-diagram__diagram .pele-zoom').should('not.exist')
    cy.get(`${VIEW} svg.pele`).should('not.have.attr', 'tabindex')
    cy.get(`${VIEW} svg.pele`).should('not.have.css', 'touch-action', 'pan-y')
  })

  // Only CSS reads the media feature, so CDP emulation is the one switch. The shorthand
  // order in mermaid.css fixes the order of each duration list.
  it('drops every head, fold and state motion under reduced motion', () => {
    const motion = (doc: Document): Record<string, string> => {
      const style = (selector: string): CSSStyleDeclaration =>
        getComputedStyle(doc.querySelector(selector)!)
      return {
        label: style('.mermaid-diagram__label').transitionDuration,
        actions: style('.mermaid-diagram__actions').transitionDuration,
        button: style('.mermaid-diagram__fold').transitionDuration,
        icon: style('.mermaid-diagram__icon').transitionDuration,
        source: style('.mermaid-diagram__source').transitionDuration,
        pre: style('.mermaid-diagram__source > pre').transitionDuration,
        svg: style('svg.pele').transitionDuration,
        spinner: style('.mermaid-diagram__spinner').animationName,
        error: style('.mermaid-diagram__error:not([hidden])').animationName
      }
    }

    cy.visitPlayground()
    cy.setEditorContent(block(GOOD) + block(BROKEN) + FILLER + block(PIE) + '<p>After</p>')
    expectReady()
    cy.get(VIEW).eq(1).should('have.attr', 'data-state', 'error')
    cy.get(VIEW).eq(2).should('have.attr', 'data-state', 'loading')
    cy.get('.mermaid-diagram').first().scrollIntoView()
    // Electron follows the OS setting, so the baseline is pinned too.
    cdp('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }]
    })

    cy.document().then((doc) => {
      expect(motion(doc)).to.deep.equal({
        label: '0.08s, 0.08s',
        actions: '0.08s, 0.08s',
        button: '0.12s, 0.12s, 0.08s',
        icon: '0.2s',
        source: '0.2s',
        pre: '0.2s, 0s',
        svg: '0.2s',
        spinner: 'mermaid-diagram-spin',
        error: 'mermaid-diagram-rise'
      })
    })
    cy.get('.mermaid-diagram__fold').first().focus()
    cy.get('.mermaid-diagram__actions')
      .first()
      .should('have.css', 'transition-duration', '0.12s, 0.12s')

    cdp('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    })
    cy.window().then((win) => {
      expect(win.matchMedia('(prefers-reduced-motion: reduce)').matches).to.equal(true)
      expect(motion(win.document)).to.deep.equal({
        label: '0s',
        actions: '0s',
        button: '0s',
        icon: '0s',
        source: '0s',
        pre: '0s',
        svg: '0s',
        spinner: 'none',
        error: 'none'
      })
    })
    cy.get('.mermaid-diagram__actions').first().should('have.css', 'opacity', '1')
  })

  // theme.ts writes the option once, at build time, so runtime theming is pure CSS. A
  // redraw would replace the SVG and drop any focus or zoom inside it. Colour variables
  // only: a font variable makes Pele measure again and redraw on purpose.
  it('recolours a drawn diagram in place when theme variables or the colour scheme change', () => {
    const svgs: Element[] = []
    let redraws = 0
    const colours = (): Cypress.Chainable<Record<'node' | 'edge' | 'label' | 'slice', string>> =>
      cy.document().then((doc) => {
        const read = (selector: string, property: 'fill' | 'stroke'): string =>
          getComputedStyle(doc.querySelector(selector)!)[property]
        return {
          node: read('svg.pele-flowchart g.pele-node rect', 'fill'),
          edge: read('svg.pele-flowchart g.pele-edge path:not(.pele-marker)', 'stroke'),
          label: read('svg.pele-flowchart text.pele-label', 'fill'),
          slice: read('svg.pele-pie path.pele-slice', 'fill')
        }
      })

    cy.visitPlayground()
    cy.document().then((doc) => doc.documentElement.setAttribute('data-theme', 'light'))
    cy.setEditorContent(block(GOOD) + block(PIE) + '<p>After</p>')
    expectReady(0)
    expectReady(1)
    cy.window().then((win) => {
      const observer = new win.MutationObserver((records) => {
        redraws += records.length
      })
      win.document.querySelectorAll('svg.pele').forEach((svg) => {
        svgs.push(svg)
        observer.observe(svg.parentElement!, { childList: true })
      })
    })
    colours().should('deep.equal', {
      node: 'rgb(243, 244, 246)',
      edge: 'rgb(107, 114, 128)',
      label: 'rgb(17, 24, 39)',
      slice: 'rgb(76, 120, 168)'
    })

    cy.document().then((doc) => doc.documentElement.setAttribute('data-theme', 'dark'))
    colours().should('deep.equal', {
      node: 'rgb(55, 65, 81)',
      edge: 'rgb(156, 163, 175)',
      label: 'rgb(243, 244, 246)',
      slice: 'rgb(76, 120, 168)'
    })

    stylesheet(
      '.mermaid-diagram:has(.pele-flowchart) { --pele-surface: rgb(1, 2, 3); ' +
        '--pele-line: rgb(4, 5, 6); --pele-fg: rgb(7, 8, 9) }' +
        '.mermaid-diagram:has(.pele-pie) { --pele-series-1: rgb(10, 11, 12) }'
    )
    colours().should('deep.equal', {
      node: 'rgb(1, 2, 3)',
      edge: 'rgb(4, 5, 6)',
      label: 'rgb(7, 8, 9)',
      slice: 'rgb(10, 11, 12)'
    })

    // docs/guide.md: the frame's own defaults shadow any value set on an ancestor.
    stylesheet('#editor { --pele-border: rgb(200, 0, 0); --pele-muted: rgb(200, 0, 0) }')
    cy.get('svg.pele-flowchart g.pele-node rect').should('have.css', 'stroke', 'rgb(55, 65, 81)')
    cy.get('.mermaid-diagram__label').first().should('have.css', 'color', 'rgb(156, 163, 175)')

    twoFrames()
    cy.get(VIEW).each(($view) => expect($view.attr('data-state')).to.equal('ready'))
    cy.get('svg.pele').then(($svgs) => {
      expect($svgs.length).to.equal(svgs.length)
      $svgs.each((i, svg) => {
        expect(svg === svgs[i], `svg ${i} kept`).to.equal(true)
      })
      expect(redraws).to.equal(0)
    })
  })

  // Small text needs 4.5:1 (WCAG AA). light-dark() resolves against the nearest
  // color-scheme, which the playground sets from data-theme on <html>.
  it('keeps the frame, head, source and error text readable in a dark colour scheme', () => {
    cy.visitPlayground()
    cy.document().then((doc) => doc.documentElement.setAttribute('data-theme', 'dark'))
    cy.setEditorContent(block(GOOD) + block(BROKEN) + '<p>After</p>')
    expectReady(0)
    cy.get(VIEW).eq(1).should('have.attr', 'data-state', 'error')
    cy.get('.mermaid-diagram__error').should('be.visible')

    cy.document().then((doc) => {
      expect(getComputedStyle(doc.documentElement).colorScheme).to.equal('dark')
      const style = (selector: string): CSSStyleDeclaration =>
        getComputedStyle(doc.querySelector(selector)!)
      const paper = style('.mermaid-diagram__preview').backgroundColor
      const well = style('.mermaid-diagram__source > pre').backgroundColor
      const head = style('.mermaid-diagram__head').backgroundColor
      expect(paper).to.equal('rgb(31, 41, 55)')

      const pairs: [string, string, string][] = [
        ['error message', style('.mermaid-diagram__message').color, paper],
        ['error detail', style('.mermaid-diagram__detail').color, paper],
        ['head label', style('.mermaid-diagram__label').color, head],
        ['head button', style('.mermaid-diagram__fold').color, head],
        ['source text', style('.mermaid-diagram__source > pre').color, well],
        ['diagram label', style('svg.pele text.pele-label').fill, paper]
      ]
      for (const [part, foreground, background] of pairs) {
        expect(contrast(foreground, background), part).to.be.at.least(4.5)
      }
    })
  })

  // Zoom keys are bound on the diagram host, the caret keys on the editor root. A leak either
  // way pans the diagram while the writer types, or types while the reader zooms.
  it('keeps diagram zoom keys and the editor caret apart on a fine pointer', () => {
    let viewBox = ''
    let texts: string[] = []
    const svg = (): Cypress.Chainable<JQuery<SVGSVGElement>> => cy.get(`${VIEW} svg.pele`)

    cy.visitPlayground()
    cy.setEditorContent('<p>Before</p>' + block(WIDE) + '<p>After</p>' + FILLER)
    expectReady()
    cy.get('.mermaid-diagram__diagram .pele-zoom').should('exist')
    svg()
      .invoke('attr', 'viewBox')
      .then((value) => {
        viewBox = String(value)
      })

    caretInParagraph('After', 2)
    cy.realPress('ArrowLeft')
    cy.realPress('ArrowRight')
    cy.realType('Z')
    paragraphTexts().should('include', 'AfZter')
    svg().should(($svg) => expect($svg.attr('viewBox')).to.equal(viewBox))
    cy.get('.pele-zoom-reset').should('have.css', 'display', 'none')

    paragraphTexts().then((value) => {
      texts = value
    })
    svg().focus()
    cy.focused().should('match', 'svg.pele')
    cy.realPress('=')
    svg().should(($svg) => expect($svg.attr('viewBox'), 'zoomed in').not.to.equal(viewBox))
    cy.get('.pele-zoom-reset').should('have.css', 'display', 'grid')
    svg()
      .invoke('attr', 'viewBox')
      .then((zoomed) => {
        cy.realPress('ArrowRight')
        svg().should(($svg) => expect($svg.attr('viewBox'), 'panned').not.to.equal(zoomed))
      })
    cy.realType('q')
    cy.realPress('Escape')
    svg().should(($svg) => expect($svg.attr('viewBox')).to.equal(viewBox))
    paragraphTexts().should((value) => expect(value).to.deep.equal(texts))

    // A plain wheel belongs to the page; only Ctrl or Cmd with the wheel zooms the diagram.
    cy.window().then((win) => {
      win.document.querySelector('svg.pele')!.scrollIntoView({ block: 'center' })
      const before = win.document.scrollingElement!.scrollTop
      svg().realMouseWheel({ deltaY: 300, scrollBehavior: false })
      cy.wrap(null).should(() => {
        expect(win.document.scrollingElement!.scrollTop, 'page scroll').to.be.greaterThan(before)
      })
      svg().should(($svg) => expect($svg.attr('viewBox')).to.equal(viewBox))
    })
    svg().then(($svg) => {
      const win = $svg[0].ownerDocument.defaultView!
      const box = $svg[0].getBoundingClientRect()
      const wheel = new win.WheelEvent('wheel', {
        deltaY: -100,
        ctrlKey: true,
        clientX: box.left + box.width / 2,
        clientY: box.top + box.height / 2,
        bubbles: true,
        cancelable: true
      })
      $svg[0].dispatchEvent(wheel)
      expect(wheel.defaultPrevented).to.equal(true)
    })
    svg().should(($svg) => expect($svg.attr('viewBox'), 'wheel zoom').not.to.equal(viewBox))
  })

  it('prints a ready diagram as the picture and a broken one as its source, without head or zoom', () => {
    cy.visitPlayground()
    cy.setEditorContent(block(WIDE) + block(BROKEN) + '<p>After</p>')
    expectReady(0)
    cy.get(VIEW).eq(1).scrollIntoView().should('have.attr', 'data-state', 'error')
    cy.get('.mermaid-diagram .pele-zoom').should('exist')
    cdp('Emulation.setEmulatedMedia', { media: 'print', features: [] })

    cy.get('.mermaid-diagram__head').each(($head) => expect($head.css('display')).to.equal('none'))
    cy.get('.mermaid-diagram .pele-zoom').should('have.css', 'display', 'none')
    cy.get('.mermaid-diagram')
      .eq(0)
      .within(() => {
        cy.get('.mermaid-diagram__source').should('have.css', 'display', 'none')
        cy.get(VIEW.slice('.mermaid-diagram > '.length)).should('not.have.css', 'display', 'none')
        cy.get('.mermaid-diagram__diagram')
          .should('have.css', 'overflow', 'visible')
          .and(($host) => expect(getComputedStyle($host[0]).contain).to.equal('none'))
      })
    cy.get('.mermaid-diagram')
      .eq(1)
      .within(() => {
        cy.get('.mermaid-diagram__source').should('not.have.css', 'display', 'none')
        cy.get('[data-state]').should('have.css', 'display', 'none')
      })
  })

  it('prints the source of a folded block that never drew', () => {
    cy.visitPlayground('?readonly')
    cy.setEditorContent(FILLER + block(GOOD) + '<p>After</p>')
    cy.get('.mermaid-diagram').should('have.attr', 'data-source', 'folded')
    cy.get(VIEW).should('have.attr', 'data-state', 'loading')
    cdp('Emulation.setEmulatedMedia', { media: 'print', features: [] })
    cy.get('.mermaid-diagram__source pre')
      .should('have.css', 'visibility', 'visible')
      .and(($pre) => expect($pre[0].getBoundingClientRect().height).to.be.greaterThan(20))
  })

  it('keeps the block when a host sets a theme variable inline on the frame at runtime', () => {
    let frame: HTMLElement
    let svg: Element
    cy.visitPlayground()
    cy.setEditorContent(block(GOOD) + '<p>After</p>')
    expectReady()
    cy.get('.mermaid-diagram').then(($frame) => {
      frame = $frame[0]
      svg = frame.querySelector('svg.pele')!
      frame.style.setProperty('--pele-accent', 'rgb(255, 0, 0)')
    })
    twoFrames()
    cy.wait(300)
    cy.get('.mermaid-diagram').should(($frame) => {
      expect($frame[0], 'same frame').to.equal(frame)
      expect($frame[0].style.getPropertyValue('--pele-accent')).to.equal('rgb(255, 0, 0)')
      expect(frame.querySelector('svg.pele'), 'same svg').to.equal(svg)
    })
  })
})

export {}
