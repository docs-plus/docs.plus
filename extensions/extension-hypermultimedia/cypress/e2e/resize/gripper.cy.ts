const MIN_WIDTH = 160
const MIN_HEIGHT = 80

const YOUTUBE_SRC = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

/** Yields the committed size after it checks whole numbers, the ratio and the painted box. */
function expectCornerRatio(nodeName: string, selector: string, ratio: number, tolerance = 0.02) {
  return cy.nodeAttr(nodeName, 'width').then((width) =>
    cy.nodeAttr(nodeName, 'height').then((height) => {
      const size = { width: Number(width), height: Number(height) }
      expect(Number.isInteger(size.width) && Number.isInteger(size.height)).to.eq(true)
      expect(size.width / size.height).to.be.closeTo(ratio, tolerance)
      cy.expectRenderedMediaSize(selector, 'width', size.width)
      cy.expectRenderedMediaSize(selector, 'height', size.height)
      return cy.wrap(size)
    })
  )
}

describe('resize gripper', () => {
  beforeEach(() => {
    cy.visitPlayground()
  })

  describe('selection controls', () => {
    it('mounts a gripper decoration for resizable image nodes', () => {
      cy.insertSizedImage(200, 150)
      cy.get('#editor .hypermultimedia__resize-gripper').should('exist')
    })

    it('mounts gripper decorations for other resizable embed nodes', () => {
      cy.getEditor().then((editor) => {
        editor.commands.setYoutubeVideo({ src: YOUTUBE_SRC })
      })
      cy.get('#editor .hypermultimedia__resize-gripper').should('exist')
    })

    it('activates with eight handles when the image is hovered', () => {
      cy.prepareImageForResize(200, 150)
      cy.get('#editor .hypermultimedia__resize-gripper--active .media-resize-clamp').should(
        'have.length',
        8
      )
    })

    it('activates on hover for youtube embed wrappers', () => {
      cy.getEditor().then((editor) => {
        editor.commands.setYoutubeVideo({ src: YOUTUBE_SRC })
      })
      cy.hoverMediaControls('#editor .hypermultimedia--youtube__content')
      cy.get('#editor .hypermultimedia__resize-gripper--active').should('exist')
    })

    it('keeps gripper visible and iframe clickable while hovered (Notion-style)', () => {
      cy.getEditor().then((editor) => {
        editor.commands.setYoutubeVideo({ src: YOUTUBE_SRC })
      })
      cy.hoverMediaControls('#editor .hypermultimedia--youtube__content')
      cy.get('#editor .hypermultimedia__resize-gripper--active').should('exist')
      cy.get('#editor .hypermultimedia--youtube__content iframe').should(
        'have.css',
        'pointer-events',
        'auto'
      )
      cy.get('#editor .hypermultimedia--youtube__content').click('center')
      cy.get('#editor .hypermultimedia__resize-gripper--active').should('exist')
    })

    it('captures pointer on the gripper widget during drag without hiding the iframe', () => {
      cy.getEditor().then((editor) => {
        editor.commands.setYoutubeVideo({ src: YOUTUBE_SRC })
      })
      cy.hoverMediaControls('#editor .hypermultimedia--youtube__content')
      cy.get(
        '#editor .hypermultimedia__resize-gripper--active .media-resize-clamp--right'
      ).realMouseDown({ position: 'center' })
      cy.get('#editor .hypermultimedia__resize-gripper--dragging').should('exist')
      // Loading shell keeps the slot at opacity:0 until embed load — assert the iframe
      // stays mounted and un-hidden, not Cypress "visible" (covered by gripper overlay).
      cy.get('#editor .hypermultimedia--youtube__content iframe').should(($iframe) => {
        const el = $iframe[0]
        expect(el.isConnected).to.eq(true)
        expect(getComputedStyle(el).display).not.to.eq('none')
        expect(getComputedStyle(el).visibility).not.to.eq('hidden')
      })
      cy.get('body').realMouseUp()
      cy.get('#editor .hypermultimedia__resize-gripper--dragging').should('not.exist')
    })

    it('keeps resize drag attached when the pointer crosses the iframe', () => {
      cy.getEditor().then((editor) => {
        editor.commands.setYoutubeVideo({
          src: YOUTUBE_SRC,
          width: 400,
          height: 300
        })
      })
      cy.hoverMediaControls('#editor .hypermultimedia--youtube__content')
      cy.nodeAttr('youtube', 'width').then((before) => {
        const startWidth = Number(before)
        cy.get('#editor .hypermultimedia__resize-gripper--active .media-resize-clamp--right').then(
          ($clamp) => {
            const rect = $clamp[0].getBoundingClientRect()
            const startX = rect.left + rect.width / 2
            const startY = rect.top + rect.height / 2
            cy.wrap($clamp).realMouseDown({ position: 'center' })
            cy.get('#editor .hypermultimedia--youtube__content iframe').realHover()
            cy.get('body').realMouseMove(startX + 80, startY)
            cy.get('body').realMouseUp()
          }
        )
        cy.nodeAttr('youtube', 'width').should((after) => {
          expect(Number(after)).to.be.greaterThan(startWidth)
        })
      })
    })

    it('keeps resize drag attached when the pointer leaves the editor and returns', () => {
      cy.prepareImageForResize(200, 150)
      cy.get('#editor .hypermultimedia__resize-gripper--active .media-resize-clamp--right').then(
        ($clamp) => {
          const rect = $clamp[0].getBoundingClientRect()
          const startX = rect.left + rect.width / 2
          const startY = rect.top + rect.height / 2
          cy.wrap($clamp).realMouseDown({ position: 'center' })
          cy.window().then((win) => {
            cy.get('body').realMouseMove(win.innerWidth - 4, 4)
            cy.get('body').realMouseMove(startX + 60, startY)
            cy.get('body').realMouseUp()
          })
        }
      )
      cy.nodeAttr('image', 'width').should((width) => {
        expect(Number(width)).to.be.greaterThan(200)
      })
    })

    it('shows gripper on hover again after a resize drag', () => {
      cy.prepareImageForResize(200, 150)
      cy.dragResizeClamp('right', 40)
      cy.get('#editor img').trigger('mouseover', { force: true })
      cy.get('#editor .hypermultimedia__resize-gripper--active').should('exist')
    })

    it('deactivates when clicking outside the image', () => {
      cy.prepareImageForResize(200, 150)
      cy.get('#editor .ProseMirror p')
        .first()
        .trigger('pointerdown', { force: true, bubbles: true })
      cy.get('#editor .hypermultimedia__resize-gripper--active').should('not.exist')
    })
  })

  describe('side handles', () => {
    it('grows width when dragging the right handle outward', () => {
      cy.prepareImageForResize(200, 150)
      cy.dragResizeClamp('right', 60)
      cy.nodeAttr('image', 'width').should((width) => {
        expect(Number(width)).to.be.greaterThan(200)
      })
    })

    it('renders the resized width on the <img>, not just the node attr', () => {
      cy.prepareImageForResize(200, 150)
      cy.dragResizeClamp('right', 60)
      cy.nodeAttr('image', 'width').then((attrWidth) => {
        cy.expectRenderedMediaSize('#editor img', 'width', Number(attrWidth))
      })
    })

    it('shrinks width when dragging the left handle inward', () => {
      cy.prepareImageForResize(260, 150)
      cy.dragResizeClamp('left', 80)
      cy.nodeAttr('image', 'width').should((width) => {
        expect(Number(width)).to.be.lessThan(260)
      })
    })

    it('grows height when dragging the bottom handle downward', () => {
      cy.prepareImageForResize(200, 150)
      cy.dragResizeClamp('bottom', 0, 60)
      cy.nodeAttr('image', 'height').then((attrHeight) => {
        expect(Number(attrHeight)).to.be.greaterThan(150)
        cy.expectRenderedMediaSize('#editor img', 'height', Number(attrHeight))
      })
    })

    it('renders the resized height on the <video>, not just the node attr', () => {
      cy.getEditor().then((editor) => {
        editor.commands.setVideo({
          src: 'https://example.com/clip.mp4',
          width: 400,
          height: 300
        })
      })
      cy.hoverMediaControls('#editor .hypermultimedia--video__content')
      cy.dragResizeClamp('bottom', 0, 50)
      cy.nodeAttr('video', 'height').then((attrHeight) => {
        const expected = Number(attrHeight)
        cy.expectRenderedMediaSize(
          '#editor .hypermultimedia--video__content video',
          'height',
          expected
        )
        cy.expectRenderedMediaSize('#editor .hm-media-host', 'height', expected)
      })
    })

    it('renders the resized height on the youtube iframe, not just the node attr', () => {
      cy.getEditor().then((editor) => {
        editor.commands.setYoutubeVideo({
          src: YOUTUBE_SRC,
          width: 400,
          height: 300
        })
      })
      cy.hoverMediaControls('#editor .hypermultimedia--youtube__content')
      cy.dragResizeClamp('bottom', 0, 50)
      cy.nodeAttr('youtube', 'height').then((attrHeight) => {
        const expected = Number(attrHeight)
        cy.expectRenderedMediaSize(
          '#editor .hypermultimedia--youtube__content iframe',
          'height',
          expected
        )
        cy.expectRenderedMediaSize('#editor .hm-media-host', 'height', expected)
      })
    })
  })

  describe('corner handles', () => {
    it('keeps the aspect ratio on an image corner drag', () => {
      cy.prepareImageForResize(200, 150)
      cy.dragResizeClamp('bottom-right', 80, 10)
      expectCornerRatio('image', '#editor img', 4 / 3)
        .its('width')
        .should('be.greaterThan', 200)
    })

    it('ignores Shift during a corner drag', () => {
      cy.prepareImageForResize(200, 150)
      cy.get(
        '#editor .hypermultimedia__resize-gripper--active .media-resize-clamp--bottom-right'
      ).then(($clamp) => {
        const rect = $clamp[0].getBoundingClientRect()
        const x = rect.left + rect.width / 2
        const y = rect.top + rect.height / 2
        cy.wrap($clamp).realMouseDown({ position: 'center', shiftKey: true })
        // Shift goes down after the drag starts, where a listener bound at drag start would see it.
        cy.document().trigger('keydown', { key: 'Shift' })
        cy.get('body').realMouseMove(x + 80, y + 10, { shiftKey: true })
        cy.get('body').realMouseUp({ shiftKey: true })
        cy.document().trigger('keyup', { key: 'Shift' })
      })
      expectCornerRatio('image', '#editor img', 4 / 3)
        .its('width')
        .should('be.greaterThan', 200)
    })

    it('keeps the aspect ratio on a youtube corner drag', () => {
      cy.getEditor().then((editor) => {
        editor.commands.setYoutubeVideo({ src: YOUTUBE_SRC, width: 400, height: 300 })
      })
      cy.hoverMediaControls('#editor .hypermultimedia--youtube__content')
      cy.dragResizeClamp('bottom-right', 60, 0)
      expectCornerRatio('youtube', '#editor .hm-media-host', 4 / 3)
        .its('width')
        .should('be.greaterThan', 400)
    })

    it('keeps a free corner drag on audio', () => {
      cy.getEditor().then((editor) => {
        editor.commands.setAudio({
          src: 'https://example.com/clip.mp3',
          width: 400,
          height: 120
        })
      })
      cy.hoverMediaControls('#editor .hypermultimedia--audio__content')
      cy.dragResizeClamp('bottom-right', 0, 60)
      cy.nodeAttr('audio', 'width').should((width) => {
        expect(Number(width)).to.be.closeTo(400, 2)
      })
      cy.nodeAttr('audio', 'height').then((height) => {
        expect(Number(height)).to.be.closeTo(180, 2)
        cy.expectRenderedMediaSize('#editor .hm-media-host', 'height', Number(height))
      })
    })
  })

  describe('drag cancellation', () => {
    it('Escape mid-drag snaps back and the following mouseup commits nothing', () => {
      cy.prepareImageForResize(200, 150)
      cy.get('#editor .hypermultimedia__resize-gripper').then(($gripper) => {
        cy.wrap($gripper[0].offsetWidth).as('preDragWidth')
      })
      cy.get('#editor .hypermultimedia__resize-gripper--active .media-resize-clamp--right').then(
        ($clamp) => {
          const rect = $clamp[0].getBoundingClientRect()
          const startX = rect.left + rect.width / 2
          const startY = rect.top + rect.height / 2
          cy.wrap($clamp).realMouseDown({ position: 'center' })
          cy.get('body').realMouseMove(startX + 80, startY)
        }
      )
      // The preview must visibly grow first, or Escape would have nothing to undo.
      cy.get<number>('@preDragWidth').then((preDragWidth) => {
        cy.get('#editor .hypermultimedia__resize-gripper--dragging').should(($gripper) => {
          expect($gripper[0].getBoundingClientRect().width).to.be.greaterThan(preDragWidth)
        })
        cy.get('body').realPress('Escape')
        cy.get('#editor .hypermultimedia__resize-gripper--dragging').should('not.exist')
        // Snap-back: dragged preview width must be gone — restored to the pre-drag
        // box, or '' when the post-cancel deactivation cleared inline styles.
        cy.get('#editor .hypermultimedia__resize-gripper').should(($gripper) => {
          expect($gripper[0].style.width).to.be.oneOf(['', `${preDragWidth}px`])
        })
      })
      // Post-Escape mouseup is the discriminating step — it is what would
      // wrongly commit the dragged size if the cancel path regressed.
      cy.get('body').realMouseUp()
      cy.nodeAttr('image', 'width').should((width) => {
        expect(Number(width)).to.eq(200)
      })
      cy.expectRenderedMediaSize('#editor img', 'width', 200)
    })
  })

  describe('constraints', () => {
    it('does not shrink below the minimum width', () => {
      cy.prepareImageForResize(200, 150)
      cy.dragResizeClamp('left', 200)
      cy.nodeAttr('image', 'width').should((width) => {
        expect(Number(width)).to.be.at.least(MIN_WIDTH)
      })
    })

    it('does not shrink below the minimum height', () => {
      cy.prepareImageForResize(200, 150)
      cy.dragResizeClamp('top', 0, 200)
      cy.nodeAttr('image', 'height').should((height) => {
        expect(Number(height)).to.be.at.least(MIN_HEIGHT)
      })
    })

    it('keeps the ratio at the minimum size on a corner drag', () => {
      cy.prepareImageForResize(400, 100)
      cy.get(
        '#editor .hypermultimedia__resize-gripper--active .media-resize-clamp--bottom-right'
      ).then(($clamp) => {
        const rect = $clamp[0].getBoundingClientRect()
        cy.wrap($clamp).realMouseDown({ position: 'center' })
        // Past the opposite corner, so the raw drag size is negative.
        cy.get('body').realMouseMove(rect.left + rect.width / 2 - 450, rect.top + rect.height / 2)
        // The commit clamps again, so only the preview shows a ratio lost mid-drag.
        cy.get('#editor .hypermultimedia__resize-gripper--active').should(($gripper) => {
          expect($gripper[0].style.width).to.eq(`${MIN_HEIGHT * 4}px`)
          expect($gripper[0].style.height).to.eq(`${MIN_HEIGHT}px`)
        })
        cy.get('body').realMouseUp()
      })
      expectCornerRatio('image', '#editor img', 4, 0.05).should('deep.equal', {
        width: MIN_HEIGHT * 4,
        height: MIN_HEIGHT
      })
    })

    it('does not grow wider than the editor content column', () => {
      cy.getEditor().then((editor) => {
        editor.commands.setYoutubeVideo({ src: YOUTUBE_SRC })
      })
      cy.get('#editor').then(($editor) => {
        const root = $editor[0]
        const prose = root.classList.contains('ProseMirror')
          ? root
          : root.querySelector('.ProseMirror')
        const maxWidth = prose?.clientWidth ?? root.clientWidth
        expect(maxWidth).to.be.greaterThan(0)
        cy.wrap(maxWidth).as('maxWidth')
      })
      cy.hoverMediaControls('#editor .hypermultimedia--youtube__content')
      cy.dragResizeClamp('right', 2000)
      cy.get<number>('@maxWidth').then((maxWidth) => {
        cy.nodeAttr('youtube', 'width').should((width) => {
          expect(Number(width)).to.be.at.most(maxWidth)
        })
      })
    })

    it('keeps the ratio when a corner drag stops at the column width', () => {
      cy.prepareImageForResize(400, 300)
      cy.get('#editor .ProseMirror').then(($prose) => {
        const maxWidth = $prose[0].clientWidth
        // 400 + 300 passes the column, and the pointer stays inside the viewport, so the move still fires.
        cy.dragResizeClamp('bottom-right', 300, 10)
        expectCornerRatio('image', '#editor img', 4 / 3)
          .its('width')
          .should('be.within', maxWidth - 2, maxWidth)
      })
    })

    it('removes gripper and toolbar when the hovered media node is deleted', () => {
      cy.getEditor().then((editor) => {
        editor.commands.setYoutubeVideo({ src: YOUTUBE_SRC })
      })
      cy.hoverMediaControls('#editor .hypermultimedia--youtube__content')
      cy.get('#editor .hypermultimedia__resize-gripper--active').should('exist')
      cy.get('#editor .hypermultimedia--youtube__content > .media-toolbar').should('exist')
      cy.getEditor().then((editor) => {
        let pos = -1
        editor.state.doc.descendants((node, nodePos) => {
          if (node.type.name === 'youtube' && pos === -1) {
            pos = nodePos
            return false
          }
        })
        const node = pos >= 0 ? editor.state.doc.nodeAt(pos) : null
        if (!node) throw new Error('youtube node missing')
        editor.view.dispatch(editor.state.tr.delete(pos, pos + node.nodeSize))
      })
      cy.get('#editor .hypermultimedia__resize-gripper--active').should('not.exist')
      cy.get('#editor .media-toolbar').should('not.exist')
    })

    it('deletes the hovered media node when Delete is pressed with focus outside the editor', () => {
      cy.getEditor().then((editor) => {
        editor.commands.setYoutubeVideo({ src: YOUTUBE_SRC })
      })
      cy.nodeCount('youtube').should('eq', 1)
      cy.hoverMediaControls('#editor .hypermultimedia--youtube__content')
      cy.get('#editor .hypermultimedia__resize-gripper--active').should('exist')
      // Focus stays outside the editor: a focused text caret keeps Delete for text editing.
      cy.get('body').realPress('Delete')
      cy.nodeCount('youtube').should('eq', 0)
      cy.get('#editor .hypermultimedia__resize-gripper--active').should('not.exist')
      cy.get('#editor .media-toolbar').should('not.exist')
    })
  })
})

export {}
