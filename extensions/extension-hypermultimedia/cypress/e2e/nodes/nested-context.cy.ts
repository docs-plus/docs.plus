const RECT_TOLERANCE_PX = 4
const IMAGE_WIDTH = 320
const IMAGE_HEIGHT = 200

/** Rect-vs-rect, not offsets: offsetParent drift inside nested blocks surfaces as a measured delta. */
function expectGripperTracksImage(imgSelector: string): void {
  cy.get('#editor .hypermultimedia__resize-gripper--active').should(($gripper) => {
    const img = Cypress.$(imgSelector)[0]
    expect(img, `${imgSelector} rendered`).to.exist
    const imgRect = img.getBoundingClientRect()
    const gripperRect = $gripper[0].getBoundingClientRect()
    expect(gripperRect.left, 'gripper left tracks img').to.be.closeTo(
      imgRect.left,
      RECT_TOLERANCE_PX
    )
    expect(gripperRect.top, 'gripper top tracks img').to.be.closeTo(imgRect.top, RECT_TOLERANCE_PX)
    expect(gripperRect.width, 'gripper width tracks img').to.be.closeTo(
      imgRect.width,
      RECT_TOLERANCE_PX
    )
    expect(gripperRect.height, 'gripper height tracks img').to.be.closeTo(
      imgRect.height,
      RECT_TOLERANCE_PX
    )
  })
}

function expectToolbarInsideWrapper(wrapperSelector: string): void {
  cy.get(`${wrapperSelector} .media-toolbar`).should(($bar) => {
    const wrapRect = Cypress.$(wrapperSelector)[0].getBoundingClientRect()
    const barRect = $bar[0].getBoundingClientRect()
    expect(barRect.top, 'toolbar top inside wrapper').to.be.at.least(
      wrapRect.top - RECT_TOLERANCE_PX
    )
    expect(barRect.bottom, 'toolbar bottom inside wrapper').to.be.at.most(
      wrapRect.bottom + RECT_TOLERANCE_PX
    )
    expect(barRect.left, 'toolbar left inside wrapper').to.be.at.least(
      wrapRect.left - RECT_TOLERANCE_PX
    )
    expect(barRect.right, 'toolbar right inside wrapper').to.be.at.most(
      wrapRect.right + RECT_TOLERANCE_PX
    )
  })
}

/** focus('end') lands in StarterKit's trailing paragraph (outside the nested block), so derive the caret. */
function placeCaretAtEndOfFirstTextblock(): void {
  cy.getEditor().then((editor) => {
    let caretPos = -1
    editor.state.doc.descendants((node, pos) => {
      if (caretPos === -1 && node.isTextblock) caretPos = pos + 1 + node.content.size
      return caretPos === -1
    })
    expect(caretPos, 'caret position inside the nested textblock').to.be.greaterThan(0)
    editor.commands.setTextSelection(caretPos)
  })
}

function insertImageWithSelectionInside(fixtureHtml: string): void {
  cy.setEditorContent(fixtureHtml)
  placeCaretAtEndOfFirstTextblock()
  cy.insertSizedImage(IMAGE_WIDTH, IMAGE_HEIGHT)
}

describe('media controls in nested blocks', () => {
  beforeEach(() => {
    cy.visitPlayground()
  })

  it('keeps gripper and toolbar aligned to an image inside a blockquote', () => {
    insertImageWithSelectionInside('<blockquote><p>q</p></blockquote>')
    cy.get('#editor blockquote img').should('exist')
    cy.activateImageGripper()
    expectGripperTracksImage('#editor blockquote img')
    cy.hoverMediaControls('#editor blockquote .hypermultimedia--image__content')
    expectToolbarInsideWrapper('#editor blockquote .hypermultimedia--image__content')
  })

  it('keeps gripper and toolbar aligned to an image inside a bullet-list item', () => {
    insertImageWithSelectionInside('<ul><li><p>item</p></li></ul>')
    cy.get('#editor ul li img').should('exist')
    cy.activateImageGripper()
    expectGripperTracksImage('#editor ul li img')
    cy.hoverMediaControls('#editor ul li .hypermultimedia--image__content')
    expectToolbarInsideWrapper('#editor ul li .hypermultimedia--image__content')
  })
})

export {}
