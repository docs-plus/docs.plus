describe('paste-to-node matrix', () => {
  beforeEach(() => {
    cy.visitPlayground()
    cy.getEditor().then((editor) => {
      editor.commands.setContent('<p></p>')
    })
  })

  const cases: Array<{ label: string; url: string; node: string }> = [
    {
      label: 'YouTube',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      node: 'youtube'
    },
    { label: 'Vimeo', url: 'https://vimeo.com/123456789', node: 'vimeo' },
    {
      label: 'SoundCloud',
      url: 'https://soundcloud.com/forss/flickermood',
      node: 'soundcloud'
    },
    { label: 'Loom', url: 'https://www.loom.com/share/abcdef1234567890', node: 'loom' },
    { label: 'X status', url: 'https://x.com/jack/status/20', node: 'x' },
    {
      label: 'X status with share query',
      url: 'https://x.com/mimalef70/status/2061467908622983192?s=20',
      node: 'x'
    },
    {
      label: 'twitter.com status',
      url: 'https://twitter.com/jack/status/20',
      node: 'x'
    },
    { label: 'image URL', url: 'https://example.com/photo.png', node: 'image' }
  ]

  cases.forEach(({ label, url, node }) => {
    it(`pastes ${label} URL into a ${node} node without a hyperlink`, () => {
      if (node === 'x') {
        cy.intercept('GET', 'https://publish.x.com/oembed*', {
          statusCode: 200,
          body: { html: '<blockquote class="twitter-tweet"><p>stub</p></blockquote>' }
        })
      }
      cy.pastePlainText(url)
      cy.nodeCount(node).should('eq', 1)
      cy.get('#editor a').should('not.exist')
      if (node === 'x') {
        cy.nodeAttr('x', 'src').should(
          'eq',
          url.replace(/^https:\/\/twitter\.com/, 'https://x.com').replace(/\?.*$/, '')
        )
      }
    })
  })

  it('coexistence: a pasted non-media URL still autolinks (hyperlink owns it)', () => {
    cy.pastePlainText('https://example.com')
    cy.get('#editor a[href*="example.com"]').should('exist')
    cy.nodeCount('youtube').should('eq', 0)
  })

  it('pastes a clipboard image file via editorFileUpload and the playground host', () => {
    cy.pasteImageFile()
    cy.get('#editor .hypermultimedia--image__content img', { timeout: 5000 }).should('exist')
    cy.nodeCount('image').should('eq', 1)
    cy.nodeAttr('image', 'src').should('match', /^blob:/)
    cy.get('#editor .ProseMirror').then(($editor) => {
      const editorWidth = $editor[0].clientWidth
      cy.get('#editor .hypermultimedia--image__content img').then(($img) => {
        expect($img[0].clientWidth).to.be.at.most(editorWidth)
      })
    })
  })
})

export {}
