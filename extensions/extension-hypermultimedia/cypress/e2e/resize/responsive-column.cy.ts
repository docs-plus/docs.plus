/// <reference types="cypress" />

const YOUTUBE_SRC = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
const IMAGE_WRAPPER = '#editor .hypermultimedia--image__content'
const YOUTUBE_WRAPPER = '#editor .hypermultimedia--youtube__content'

function insertWideYoutube(): void {
  cy.getEditor().then((editor) => {
    editor.commands.setYoutubeVideo({ src: YOUTUBE_SRC, width: 640, height: 480 })
  })
}

function expectWithinProseColumn(selector: string, tolerancePx = 2): void {
  cy.get('#editor .ProseMirror').then(($prose) => {
    const columnWidth = $prose[0].clientWidth
    expect(columnWidth, 'prose column width').to.be.greaterThan(0)
    cy.get(selector).then(($el) => {
      expect($el[0].getBoundingClientRect().width, `${selector} rendered width`).to.be.at.most(
        columnWidth + tolerancePx
      )
    })
  })
}

describe('media layout — responsive column cap', () => {
  beforeEach(() => {
    cy.visitPlayground()
    cy.viewport(375, 667)
  })

  it('shrinks a wide YouTube embed to the prose column on a narrow viewport', () => {
    insertWideYoutube()
    expectWithinProseColumn(YOUTUBE_WRAPPER)
    expectWithinProseColumn(`${YOUTUBE_WRAPPER} .hm-media-host`)
  })

  it('reflows after viewport shrink without reloading the document', () => {
    cy.viewport(1280, 800)
    insertWideYoutube()
    cy.viewport(375, 667)
    expectWithinProseColumn(YOUTUBE_WRAPPER)
  })

  it('shrinks a wide image to the prose column on a narrow viewport', () => {
    cy.insertSizedImage(640, 480)
    expectWithinProseColumn(IMAGE_WRAPPER)
    expectWithinProseColumn('#editor .hm-media-host')
    expectWithinProseColumn('#editor img')
  })
})

export {}
