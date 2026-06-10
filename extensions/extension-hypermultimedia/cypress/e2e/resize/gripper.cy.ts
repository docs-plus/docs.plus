const MIN_WIDTH = 160
const MIN_HEIGHT = 80

const YOUTUBE_SRC = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

describe('resize gripper', () => {
  beforeEach(() => {
    cy.visitPlayground()
  })

  describe('selection chrome', () => {
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
      cy.get('#editor .hypermultimedia--youtube__content iframe').should('exist').and('be.visible')
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
    it('grows width and height when dragging the bottom-right handle', () => {
      cy.prepareImageForResize(200, 150)
      cy.dragResizeClamp('bottom-right', 40, 40)
      cy.nodeAttr('image', 'width').should((width) => {
        expect(Number(width)).to.be.greaterThan(200)
      })
      cy.nodeAttr('image', 'height').should((height) => {
        expect(Number(height)).to.be.greaterThan(150)
      })
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
