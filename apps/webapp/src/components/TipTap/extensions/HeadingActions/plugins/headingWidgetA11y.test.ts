import { HEADING_ACTIONS_CLASSES } from '../types'
import { syncHeadingWrapperA11y } from './headingWidgetA11y'

const buildHeadingWrapperDom = () => {
  const heading = document.createElement('h2')
  const wrapper = document.createElement('div')
  wrapper.classList.add(HEADING_ACTIONS_CLASSES.wrap)

  const singleBtn = document.createElement('button')
  singleBtn.type = 'button'
  singleBtn.classList.add(HEADING_ACTIONS_CLASSES.chatBtn, HEADING_ACTIONS_CLASSES.single)

  const group = document.createElement('div')
  group.classList.add(HEADING_ACTIONS_CLASSES.group)

  const groupChatBtn = document.createElement('button')
  groupChatBtn.type = 'button'
  groupChatBtn.classList.add(HEADING_ACTIONS_CLASSES.chatBtn)

  const groupCommentBtn = document.createElement('button')
  groupCommentBtn.type = 'button'
  groupCommentBtn.classList.add(HEADING_ACTIONS_CLASSES.commentBtn)

  group.append(groupChatBtn, groupCommentBtn)
  wrapper.append(singleBtn, group)
  heading.appendChild(wrapper)

  return { heading, wrapper, singleBtn, group, groupChatBtn, groupCommentBtn }
}

const setMatchMediaDesktop = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: jest.fn().mockReturnValue({
      matches,
      media: '(hover: hover) and (pointer: fine)',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    })
  })
}

describe('syncHeadingWrapperA11y', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    jest.restoreAllMocks()
  })

  it('keeps the single chat button exposed and the group hidden on mobile when selection is active', () => {
    setMatchMediaDesktop(false)
    const mobileRoot = document.createElement('div')
    mobileRoot.className = 'mobileLayoutRoot m_mobile'
    const dom = buildHeadingWrapperDom()
    dom.wrapper.classList.add(HEADING_ACTIONS_CLASSES.hasSelection)
    mobileRoot.appendChild(dom.heading)
    document.body.appendChild(mobileRoot)

    syncHeadingWrapperA11y(dom.wrapper)

    expect(dom.singleBtn.hasAttribute('aria-hidden')).toBe(false)
    expect(dom.singleBtn.tabIndex).toBe(0)
    expect(dom.group.inert).toBe(true)
    expect(dom.group.getAttribute('aria-hidden')).toBe('true')
    expect(dom.groupChatBtn.getAttribute('aria-hidden')).toBe('true')
    expect(dom.groupChatBtn.tabIndex).toBe(-1)
    expect(dom.groupCommentBtn.getAttribute('aria-hidden')).toBe('true')
    expect(dom.groupCommentBtn.tabIndex).toBe(-1)
  })

  it('keeps the single chat button exposed when pointer is coarse without mobile shell and no selection', () => {
    setMatchMediaDesktop(false)
    const dom = buildHeadingWrapperDom()
    document.body.appendChild(dom.heading)

    syncHeadingWrapperA11y(dom.wrapper)

    expect(dom.singleBtn.hasAttribute('aria-hidden')).toBe(false)
    expect(dom.singleBtn.tabIndex).toBe(0)
    expect(dom.group.inert).toBe(true)
    expect(dom.group.getAttribute('aria-hidden')).toBe('true')
  })

  it('exposes the comment button and hides the single button when pointer is coarse without mobile shell during selection', () => {
    setMatchMediaDesktop(false)
    const dom = buildHeadingWrapperDom()
    dom.wrapper.classList.add(HEADING_ACTIONS_CLASSES.hasSelection)
    document.body.appendChild(dom.heading)

    syncHeadingWrapperA11y(dom.wrapper)

    expect(dom.singleBtn.getAttribute('aria-hidden')).toBe('true')
    expect(dom.singleBtn.tabIndex).toBe(-1)
    expect(dom.group.inert).toBe(false)
    expect(dom.group.hasAttribute('aria-hidden')).toBe(false)
    expect(dom.groupCommentBtn.hasAttribute('aria-hidden')).toBe(false)
    expect(dom.groupCommentBtn.tabIndex).toBe(0)
    expect(dom.groupChatBtn.getAttribute('aria-hidden')).toBe('true')
    expect(dom.groupChatBtn.tabIndex).toBe(-1)
  })

  it('keeps the single chat button exposed and the group hidden inside mobile shell even with fine hover during selection', () => {
    setMatchMediaDesktop(true)
    const mobileRoot = document.createElement('div')
    mobileRoot.className = 'mobileLayoutRoot m_mobile'
    const dom = buildHeadingWrapperDom()
    dom.wrapper.classList.add(HEADING_ACTIONS_CLASSES.hasSelection)
    mobileRoot.appendChild(dom.heading)
    document.body.appendChild(mobileRoot)

    syncHeadingWrapperA11y(dom.wrapper)

    expect(dom.singleBtn.hasAttribute('aria-hidden')).toBe(false)
    expect(dom.singleBtn.tabIndex).toBe(0)
    expect(dom.group.inert).toBe(true)
    expect(dom.group.getAttribute('aria-hidden')).toBe('true')
  })

  it('blurs an active single button before setting aria-hidden on desktop selection', () => {
    setMatchMediaDesktop(true)
    const dom = buildHeadingWrapperDom()
    dom.singleBtn.dataset.unreadCount = '2'
    document.body.appendChild(dom.heading)

    syncHeadingWrapperA11y(dom.wrapper)
    dom.singleBtn.focus()
    expect(document.activeElement).toBe(dom.singleBtn)

    dom.wrapper.classList.add(HEADING_ACTIONS_CLASSES.hasSelection)
    syncHeadingWrapperA11y(dom.wrapper)

    expect(document.activeElement).not.toBe(dom.singleBtn)
    expect(dom.singleBtn.getAttribute('aria-hidden')).toBe('true')
    expect(dom.singleBtn.tabIndex).toBe(-1)
    expect(dom.group.inert).toBe(false)
    expect(dom.group.hasAttribute('aria-hidden')).toBe(false)
  })

  it('blurs an active group child before setting aria-hidden when desktop selection clears', () => {
    setMatchMediaDesktop(true)
    const dom = buildHeadingWrapperDom()
    dom.wrapper.classList.add(HEADING_ACTIONS_CLASSES.hasSelection)
    document.body.appendChild(dom.heading)

    syncHeadingWrapperA11y(dom.wrapper)
    dom.groupCommentBtn.focus()
    expect(document.activeElement).toBe(dom.groupCommentBtn)

    dom.wrapper.classList.remove(HEADING_ACTIONS_CLASSES.hasSelection)
    syncHeadingWrapperA11y(dom.wrapper)

    expect(dom.group.contains(document.activeElement)).toBe(false)
    expect(dom.group.inert).toBe(true)
    expect(dom.group.getAttribute('aria-hidden')).toBe('true')
    expect(dom.singleBtn.getAttribute('aria-hidden')).toBe('true')
  })

  it('keeps the group chat button hidden when only the comment button is focused without unread or hover', () => {
    setMatchMediaDesktop(true)
    const dom = buildHeadingWrapperDom()
    dom.wrapper.classList.add(HEADING_ACTIONS_CLASSES.hasSelection)
    document.body.appendChild(dom.heading)

    syncHeadingWrapperA11y(dom.wrapper)
    dom.groupCommentBtn.focus()
    syncHeadingWrapperA11y(dom.wrapper)

    expect(dom.groupCommentBtn.hasAttribute('aria-hidden')).toBe(false)
    expect(dom.groupCommentBtn.tabIndex).toBe(0)
    expect(dom.groupChatBtn.getAttribute('aria-hidden')).toBe('true')
    expect(dom.groupChatBtn.tabIndex).toBe(-1)

    dom.groupChatBtn.dataset.unreadCount = '3'
    syncHeadingWrapperA11y(dom.wrapper)
    expect(dom.groupChatBtn.hasAttribute('aria-hidden')).toBe(false)
    expect(dom.groupChatBtn.tabIndex).toBe(0)

    dom.groupChatBtn.focus()
    expect(document.activeElement).toBe(dom.groupChatBtn)
    delete dom.groupChatBtn.dataset.unreadCount
    syncHeadingWrapperA11y(dom.wrapper)
    expect(document.activeElement).not.toBe(dom.groupChatBtn)
    expect(dom.groupChatBtn.getAttribute('aria-hidden')).toBe('true')
    expect(dom.groupChatBtn.tabIndex).toBe(-1)
  })
})
