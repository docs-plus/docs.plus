/// <reference types="jest" />

jest.mock(
  '@services/eventsHub',
  () => ({
    APPLY_FILTER: 'APPLY_FILTER',
    CHAT_OPEN: 'CHAT_OPEN'
  }),
  { virtual: true }
)

describe('navigateHref', () => {
  const originalOpen = window.open

  afterEach(() => {
    window.open = originalOpen
    jest.resetModules()
  })

  it('does not open hrefs rejected by the composed policy gate', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn(() => ({
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      }))
    })
    const { navigateHref } = require('./hrefEventHandler') as typeof import('./hrefEventHandler')
    const open = jest.fn()
    window.open = open

    navigateHref('https://blocked.test', () => false)

    expect(open).not.toHaveBeenCalled()
  })
})
