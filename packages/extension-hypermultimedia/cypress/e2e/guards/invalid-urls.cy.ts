describe('invalid URL command guards', () => {
  beforeEach(() => {
    cy.visitPlayground()
  })

  const cases: Array<{ cmd: string; args: { src: string } }> = [
    { cmd: 'setYoutubeVideo', args: { src: 'not-youtube' } },
    { cmd: 'setVimeo', args: { src: 'https://example.com/video' } },
    { cmd: 'setSoundCloud', args: { src: 'https://example.com/track' } },
    { cmd: 'setX', args: { src: 'https://example.com/status/1' } },
    { cmd: 'setLoom', args: { src: 'https://example.com/share/abc' } }
  ]

  cases.forEach(({ cmd, args }) => {
    it(`rejects ${cmd} for invalid src`, () => {
      cy.getEditor().then((editor) => {
        const commands = editor.commands as Record<string, (opts: { src: string }) => boolean>
        expect(commands[cmd](args)).to.be.false
      })
      cy.get('#editor iframe, #editor blockquote.twitter-tweet').should('not.exist')
    })
  })
})

export {}
