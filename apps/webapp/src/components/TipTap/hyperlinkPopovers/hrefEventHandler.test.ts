/// <reference types="jest" />

jest.mock(
  '@services/eventsHub',
  () => ({
    APPLY_FILTER: 'APPLY_FILTER',
    CHAT_OPEN: 'CHAT_OPEN'
  }),
  { virtual: true }
)
// The chat-link opener loads the Supabase client, which needs env this test does not set.
jest.mock('../../../services/openChatFromLink', () => ({ openChatFromLink: jest.fn() }))
jest.mock('next/router', () => ({ __esModule: true, default: { push: jest.fn() } }))

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

  it('routes a same-origin link to another pad in place, unless reserved, a public file, or Mod is held', () => {
    history.pushState({}, '', '/pad-a')
    const { navigateHref } = require('./hrefEventHandler') as typeof import('./hrefEventHandler')
    const Router = (require('next/router') as { default: { push: jest.Mock } }).default
    const open = jest.fn()
    window.open = open

    navigateHref('http://localhost/pad-b')
    expect(Router.push).toHaveBeenCalledWith('/pad-b')
    expect(open).not.toHaveBeenCalled()

    navigateHref('http://localhost/privacy')
    navigateHref('http://localhost/pad-b', undefined, { metaKey: true, ctrlKey: false })
    navigateHref('http://localhost/badges/badge-docsplus.svg')
    expect(Router.push).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledTimes(3)
  })

  it('isAnotherPad accepts a same-origin pad and refuses reserved, file and foreign hrefs', () => {
    history.pushState({}, '', '/pad-a')
    const { isAnotherPad } = require('./hrefEventHandler') as typeof import('./hrefEventHandler')

    expect(isAnotherPad('https://docs.plus/other-pad')).toBe(false)
    expect(isAnotherPad(`${window.location.origin}/other-pad`)).toBe(true)
    expect(isAnotherPad('/other-pad')).toBe(true)
    expect(isAnotherPad('/')).toBe(false)
    expect(isAnotherPad('/privacy')).toBe(false)
    expect(isAnotherPad('/badges/x.svg')).toBe(false)
    expect(isAnotherPad('http://[bad')).toBe(false)
  })
})
