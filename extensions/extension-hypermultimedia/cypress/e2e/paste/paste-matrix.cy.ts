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
    {
      label: 'Spotify track',
      url: 'https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl',
      node: 'spotify'
    },
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

  it('pastes Spotify "Copy embed" iframe code (plain text) into a spotify node', () => {
    const iframe =
      '<iframe src="https://open.spotify.com/embed/artist/5pKCCKE2ajJHZ9KAiaK11H?utm_source=generator&si=abc123" width="100%" height="352" allowfullscreen></iframe>'
    cy.pastePlainText(iframe)
    cy.nodeCount('spotify').should('eq', 1)
    cy.nodeAttr('spotify', 'src').should(
      'eq',
      'https://open.spotify.com/artist/5pKCCKE2ajJHZ9KAiaK11H'
    )
    cy.nodeAttr('spotify', 'width').should('eq', 640)
    cy.get('#editor a').should('not.exist')
  })

  it('parses a Spotify "Copy embed" iframe via setContent — width="100%" must not poison layout', () => {
    cy.getEditor().then((editor) => {
      editor.commands.setContent(
        '<iframe src="https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M?utm_source=generator&si=x" width="100%" height="352" allowfullscreen></iframe>'
      )
    })
    cy.nodeCount('spotify').should('eq', 1)
    cy.nodeAttr('spotify', 'src').should(
      'eq',
      'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'
    )
    // `width="100%"` would parseInt to 100 (a sliver) — sanitized to the column default.
    cy.nodeAttr('spotify', 'width').should('eq', 640)
    cy.nodeAttr('spotify', 'height').should('eq', 352)
  })
})

export {}
