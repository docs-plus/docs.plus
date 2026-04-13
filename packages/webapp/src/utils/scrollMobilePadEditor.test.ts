import { scrollElementInMobilePadEditor } from './scrollMobilePadEditor'

describe('scrollElementInMobilePadEditor', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('returns false when mobile pad root is absent', () => {
    document.body.innerHTML = '<div class="editor editorWrapper"></div><div data-toc-id="x"></div>'
    const el = document.querySelector('[data-toc-id="x"]')!
    expect(scrollElementInMobilePadEditor(el)).toBe(false)
  })

  it('scrolls editorWrapper to align element for block start', () => {
    const scrollTo = jest.fn()
    const root = document.createElement('div')
    root.className = 'mobileLayoutRoot'
    const wrapper = document.createElement('div')
    wrapper.className = 'editor editorWrapper'
    Object.defineProperty(wrapper, 'scrollTop', { value: 100, writable: true })
    wrapper.scrollTo = scrollTo
    const target = document.createElement('h2')
    target.setAttribute('data-toc-id', 'a')
    root.appendChild(wrapper)
    root.appendChild(target)
    document.body.appendChild(root)

    jest.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 500,
      left: 0,
      right: 300,
      width: 300,
      height: 400,
      x: 0,
      y: 100,
      toJSON: () => ({})
    } as DOMRect)
    jest.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      top: 180,
      bottom: 220,
      left: 0,
      right: 300,
      width: 300,
      height: 40,
      x: 0,
      y: 180,
      toJSON: () => ({})
    } as DOMRect)

    expect(scrollElementInMobilePadEditor(target, { block: 'start', behavior: 'auto' })).toBe(true)
    expect(scrollTo).toHaveBeenCalledWith({
      top: 100 + (180 - 100) - 12,
      behavior: 'auto'
    })
  })

  it('defaults scroll behavior to auto on mobile pad', () => {
    const scrollTo = jest.fn()
    const root = document.createElement('div')
    root.className = 'mobileLayoutRoot'
    const wrapper = document.createElement('div')
    wrapper.className = 'editor editorWrapper'
    Object.defineProperty(wrapper, 'scrollTop', { value: 100, writable: true })
    wrapper.scrollTo = scrollTo
    const target = document.createElement('h2')
    root.appendChild(wrapper)
    root.appendChild(target)
    document.body.appendChild(root)

    jest.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 500,
      left: 0,
      right: 300,
      width: 300,
      height: 400,
      x: 0,
      y: 100,
      toJSON: () => ({})
    } as DOMRect)
    jest.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      top: 180,
      bottom: 220,
      left: 0,
      right: 300,
      width: 300,
      height: 40,
      x: 0,
      y: 180,
      toJSON: () => ({})
    } as DOMRect)

    expect(scrollElementInMobilePadEditor(target, { block: 'start' })).toBe(true)
    expect(scrollTo).toHaveBeenCalledWith({
      top: 100 + (180 - 100) - 12,
      behavior: 'auto'
    })
  })
})
