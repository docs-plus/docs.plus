import { hasActiveSelectionInView } from './selectionChatPlugin'

const makeView = (dom: HTMLElement, opts: { editable: boolean; hasFocus: boolean }) => ({
  dom,
  editable: opts.editable,
  hasFocus: () => opts.hasFocus
})

describe('hasActiveSelectionInView', () => {
  afterEach(() => {
    window.getSelection()?.removeAllRanges()
    document.body.innerHTML = ''
  })

  it('delegates to view.hasFocus() when the editor is editable', () => {
    const dom = document.createElement('div')
    document.body.appendChild(dom)

    expect(hasActiveSelectionInView(makeView(dom, { editable: true, hasFocus: true }))).toBe(true)
    expect(hasActiveSelectionInView(makeView(dom, { editable: true, hasFocus: false }))).toBe(false)
  })

  it('returns true for a non-collapsed DOM range inside a non-editable view even without focus', () => {
    const dom = document.createElement('div')
    const p = document.createElement('p')
    p.textContent = 'Read-only pad text'
    dom.appendChild(p)
    document.body.appendChild(dom)

    const range = document.createRange()
    range.setStart(p.firstChild!, 0)
    range.setEnd(p.firstChild!, 9)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)

    expect(hasActiveSelectionInView(makeView(dom, { editable: false, hasFocus: false }))).toBe(true)
  })

  it('returns false when a non-editable view selection is collapsed or extends outside view.dom', () => {
    const dom = document.createElement('div')
    const p = document.createElement('p')
    p.textContent = 'Inside'
    dom.appendChild(p)

    const outside = document.createElement('p')
    outside.textContent = 'Outside'
    document.body.append(dom, outside)

    const view = makeView(dom, { editable: false, hasFocus: false })
    const selection = window.getSelection()!

    // Collapsed range inside view.dom
    const collapsed = document.createRange()
    collapsed.setStart(p.firstChild!, 2)
    collapsed.collapse(true)
    selection.removeAllRanges()
    selection.addRange(collapsed)
    expect(hasActiveSelectionInView(view)).toBe(false)

    // Non-collapsed range crossing outside view.dom
    const crossing = document.createRange()
    crossing.setStart(p.firstChild!, 0)
    crossing.setEnd(outside.firstChild!, 4)
    selection.removeAllRanges()
    selection.addRange(crossing)
    expect(hasActiveSelectionInView(view)).toBe(false)

    // Non-collapsed range wholly outside view.dom
    const external = document.createRange()
    external.setStart(outside.firstChild!, 0)
    external.setEnd(outside.firstChild!, 7)
    selection.removeAllRanges()
    selection.addRange(external)
    expect(hasActiveSelectionInView(view)).toBe(false)
  })
})
