/// <reference types="jest" />
import Router from 'next/router'

import { hrefEventHandler, navigateHref } from './hrefEventHandler'

// The chat-link opener loads the Supabase client, which needs env this test does not set.
jest.mock('../../../services/openChatFromLink', () => ({ openChatFromLink: jest.fn() }))
jest.mock('next/router', () => ({ __esModule: true, default: { push: jest.fn() } }))

describe('navigateHref', () => {
  const originalOpen = window.open

  afterEach(() => {
    window.open = originalOpen
    jest.clearAllMocks()
  })

  it('does not open hrefs rejected by the composed policy gate', () => {
    const open = jest.fn()
    window.open = open

    navigateHref('https://blocked.test', () => false)

    expect(open).not.toHaveBeenCalled()
  })

  it('routes a same-origin link to another pad in place, unless reserved or a public file', () => {
    history.pushState({}, '', '/pad-a')
    const open = jest.fn()
    window.open = open

    navigateHref('http://localhost/pad-b')
    expect(Router.push).toHaveBeenCalledWith('/pad-b')
    expect(open).not.toHaveBeenCalled()

    navigateHref('http://localhost/privacy')
    navigateHref('http://localhost/badges/badge-docsplus.svg')
    expect(Router.push).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledTimes(2)
  })
})

describe('hrefEventHandler', () => {
  const originalOpen = window.open

  afterEach(() => {
    window.open = originalOpen
    jest.clearAllMocks()
  })

  it('opens a new tab only when Mod is held, for this pad and for another pad (#678)', () => {
    history.pushState({}, '', '/pad-a')
    const open = jest.fn()
    window.open = open
    const click = (href: string, init: MouseEventInit) =>
      hrefEventHandler(href)(new MouseEvent('click', { cancelable: true, ...init }))

    // Off macOS, Meta is not Mod, so the pad still routes in place.
    click('http://localhost/pad-b', { metaKey: true })
    expect(Router.push).toHaveBeenCalledWith('/pad-b')
    expect(open).not.toHaveBeenCalled()

    click('http://localhost/pad-b', { ctrlKey: true })
    click('http://localhost/pad-a?h=intro&id=h1', { ctrlKey: true })
    expect(Router.push).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledTimes(2)
    expect(open).toHaveBeenLastCalledWith(
      'http://localhost/pad-a?h=intro&id=h1',
      '_blank',
      expect.any(String)
    )
  })
})
