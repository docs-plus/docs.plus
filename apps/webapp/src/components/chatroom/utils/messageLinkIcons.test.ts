import { stripLinkIconsOnCopy } from './messageLinkIcons'

const createCopyEvent = () => {
  const data = new Map<string, string>()
  const event = {
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true
    },
    clipboardData: {
      setData(type: string, value: string) {
        data.set(type, value)
      }
    }
  }
  return { event: event as unknown as ClipboardEvent, data }
}

const selectNodeContents = (node: Node) => {
  const range = document.createRange()
  range.selectNodeContents(node)
  const selection = window.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
}

describe('stripLinkIconsOnCopy (#697)', () => {
  afterEach(() => {
    window.getSelection()?.removeAllRanges()
    document.body.innerHTML = ''
  })

  test('strips .hyperlink-icon elements from copied HTML while keeping links and text intact', () => {
    const root = document.createElement('div')
    root.innerHTML =
      '<p>See <a href="https://docs.plus"><img class="hyperlink-icon" src="/icon.png" alt="">docs.plus</a> and <a href="https://example.com"><span class="hyperlink-icon"></span>example</a>.</p>'
    document.body.appendChild(root)
    selectNodeContents(root)

    const { event, data } = createCopyEvent()
    stripLinkIconsOnCopy(event, root)

    expect(event.defaultPrevented).toBe(true)
    const html = data.get('text/html') ?? ''
    expect(html).not.toContain('hyperlink-icon')
    expect(html).not.toContain('<img')
    expect(html).toContain('<a href="https://docs.plus">docs.plus</a>')
    expect(html).toContain('<a href="https://example.com">example</a>')
    expect(data.get('text/plain')).toBe('See docs.plus and example.')
  })

  test('leaves native copy untouched when the selection holds no link icons', () => {
    const root = document.createElement('div')
    root.innerHTML = '<p>Plain message with <a href="https://example.com">plain link</a></p>'
    document.body.appendChild(root)
    selectNodeContents(root)

    const { event, data } = createCopyEvent()
    stripLinkIconsOnCopy(event, root)

    expect(event.defaultPrevented).toBe(false)
    expect(data.size).toBe(0)
  })
})
