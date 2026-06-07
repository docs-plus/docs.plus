describe('media node insertion', () => {
  beforeEach(() => {
    cy.visitPlayground()
  })

  it('inserts an image and renders <img> under the camelCase "image" node', () => {
    cy.getEditor().then((editor) => {
      editor.commands.setImage({ src: 'https://example.com/photo.png' })
    })
    cy.get('#editor img').should('have.attr', 'src', 'https://example.com/photo.png')
    cy.nodeCount('image').should('eq', 1)
  })

  it('inserts a video and renders <video> under "video"', () => {
    cy.getEditor().then((editor) => {
      editor.commands.setVideo({ src: 'https://example.com/clip.mp4' })
    })
    cy.get('#editor video').should('exist')
    cy.nodeCount('video').should('eq', 1)
  })

  it('inserts audio and renders <audio> under "audio"', () => {
    cy.getEditor().then((editor) => {
      editor.commands.setAudio({ src: 'https://example.com/track.mp3' })
    })
    cy.get('#editor audio').should('exist')
    cy.nodeCount('audio').should('eq', 1)
  })

  it('inserts a YouTube embed (iframe) under "youtube"', () => {
    cy.getEditor().then((editor) => {
      editor.commands.setYoutubeVideo({ src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
    })
    cy.get('#editor iframe').should('have.attr', 'src').and('include', 'youtube')
    cy.nodeCount('youtube').should('eq', 1)
  })

  it('inserts a Loom embed (iframe) under "loom" with a normalized embed URL', () => {
    cy.getEditor().then((editor) => {
      editor.commands.setLoom({ src: 'https://www.loom.com/share/abcdef1234567890' })
    })
    cy.get('#editor iframe').should('have.attr', 'src').and('include', 'loom.com/embed/')
    cy.nodeCount('loom').should('eq', 1)
  })

  it('mints a unique keyId per inserted node (no shared build-time id)', () => {
    cy.getEditor().then((editor) => {
      editor.commands.setImage({ src: 'https://example.com/a.png' })
      editor.commands.setImage({ src: 'https://example.com/b.png' })
      const keyIds: string[] = []
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'image') keyIds.push(node.attrs.keyId)
      })
      expect(keyIds).to.have.length(2)
      expect(keyIds[0]).to.be.a('string')
      expect(keyIds[0]).to.not.eq(keyIds[1])
    })
  })
})

export {}
