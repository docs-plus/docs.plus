const mockSetKeyboardOpen = jest.fn()
const mockSetKeyboardHeight = jest.fn()

const store = { keyboardHeight: 0 }

jest.mock('@stores', () => ({
  useStore: {
    getState: () => ({
      get keyboardHeight() {
        return store.keyboardHeight
      },
      setKeyboardOpen: mockSetKeyboardOpen,
      setKeyboardHeight: (h: number) => {
        store.keyboardHeight = h
        mockSetKeyboardHeight(h)
      }
    })
  }
}))

import {
  applyVirtualKeyboardToStore,
  resetVirtualKeyboardSessionBaseline,
  VIRTUAL_KEYBOARD_HEIGHT_THRESHOLD_PX
} from './virtualKeyboardMetrics'

describe('applyVirtualKeyboardToStore', () => {
  beforeEach(() => {
    resetVirtualKeyboardSessionBaseline()
    store.keyboardHeight = 0
    mockSetKeyboardOpen.mockClear()
    mockSetKeyboardHeight.mockClear()
  })

  it('detects keyboard when innerHeight matches vv.height but scrollY + vv infers peak', () => {
    Object.defineProperty(window, 'innerHeight', { value: 255, configurable: true })
    Object.defineProperty(window, 'scrollY', { value: 404, configurable: true })
    Object.defineProperty(document.documentElement, 'clientHeight', {
      value: 255,
      configurable: true
    })
    Object.defineProperty(window, 'visualViewport', {
      value: {
        height: 255,
        width: 393,
        offsetTop: 404,
        offsetLeft: 0,
        scale: 1,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      },
      configurable: true
    })

    applyVirtualKeyboardToStore()

    expect(mockSetKeyboardOpen).toHaveBeenCalledWith(true)
    expect(mockSetKeyboardHeight).toHaveBeenCalled()
    const heightArg = mockSetKeyboardHeight.mock.calls[0][0]
    expect(heightArg).toBeGreaterThan(VIRTUAL_KEYBOARD_HEIGHT_THRESHOLD_PX)
  })

  it('updates keyboardHeight when keyboard stays open but vv shrinks further', () => {
    Object.defineProperty(window, 'innerHeight', { value: 500, configurable: true })
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
    Object.defineProperty(document.documentElement, 'clientHeight', {
      value: 500,
      configurable: true
    })

    const vv = {
      height: 350,
      width: 393,
      offsetTop: 0,
      offsetLeft: 0,
      scale: 1,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    }
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true })

    applyVirtualKeyboardToStore()
    expect(mockSetKeyboardOpen).toHaveBeenCalledWith(true)
    const firstHeight = mockSetKeyboardHeight.mock.calls[0][0]
    expect(firstHeight).toBeGreaterThan(VIRTUAL_KEYBOARD_HEIGHT_THRESHOLD_PX)

    mockSetKeyboardOpen.mockClear()
    mockSetKeyboardHeight.mockClear()

    vv.height = 250

    applyVirtualKeyboardToStore()

    expect(mockSetKeyboardOpen).not.toHaveBeenCalled()
    expect(mockSetKeyboardHeight).toHaveBeenCalled()
    expect(mockSetKeyboardHeight.mock.calls[0][0]).toBeGreaterThan(firstHeight + 16)
  })
})
