import { noPreviewView } from './noPreviewView'

const GENERAL = 'This site shares no preview.'

describe('noPreviewView', () => {
  test('a page shows its decoded path alone, and the reason for its miss', () => {
    expect(noPreviewView('https://www.reuters.com/tech/chip%20market?a=1#b', 'blocked')).toEqual({
      title: 'www.reuters.com',
      path: '/tech/chip market',
      reason: 'This site does not share previews.'
    })
  })

  test('a home page shows no path line', () => {
    expect(noPreviewView('https://status.example.com/').path).toBe('')
  })

  test('a file wins over the server reason, whatever the case of its extension', () => {
    expect(noPreviewView('https://www.w3.org/WAI/files/pdf/dummy.PDF?x=1', 'blocked')).toEqual({
      title: 'dummy.PDF',
      path: 'www.w3.org/WAI/files/pdf/',
      reason: 'A PDF file. Open it to read it.'
    })
  })

  test('a double extension reads its last part', () => {
    expect(noPreviewView('https://a.example/src.tar.gz').reason).toBe(
      'An archive file. Open it to download it.'
    )
  })

  test.each(['https://a.example/v1.2/', 'https://a.example/.pdf', 'https://a.example/?file=a.pdf'])(
    '%s is a page',
    (href) => {
      expect(noPreviewView(href).reason).toBe(GENERAL)
    }
  )
})
