/// <reference types="jest" />
import Router from 'next/router'

import { navigateHref } from './hrefEventHandler'

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

  it('routes a same-origin link to another pad in place, unless reserved, a public file, or Mod is held', () => {
    history.pushState({}, '', '/pad-a')
    const open = jest.fn()
    window.open = open

    navigateHref('http://localhost/pad-b')
    expect(Router.push).toHaveBeenCalledWith('/pad-b')
    expect(open).not.toHaveBeenCalled()

    // Off macOS, Meta is not Mod, so the pad still routes in place.
    navigateHref('http://localhost/pad-b', undefined, { metaKey: true, ctrlKey: false })
    expect(Router.push).toHaveBeenCalledTimes(2)

    navigateHref('http://localhost/privacy')
    navigateHref('http://localhost/pad-b', undefined, { metaKey: false, ctrlKey: true })
    navigateHref('http://localhost/badges/badge-docsplus.svg')
    expect(Router.push).toHaveBeenCalledTimes(2)
    expect(open).toHaveBeenCalledTimes(3)
  })
})
