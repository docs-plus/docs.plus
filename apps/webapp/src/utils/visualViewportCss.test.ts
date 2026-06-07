import { syncVisualViewportToCssVars } from './visualViewportCss'

describe('syncVisualViewportToCssVars', () => {
  const vv = { height: 500, width: 390, offsetTop: 0, offsetLeft: 0 }

  beforeEach(() => {
    vv.height = 500
    vv.width = 390
    vv.offsetTop = 0
    vv.offsetLeft = 0
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: vv
    })
  })

  it('writes visual viewport size, offsets, and --vh', () => {
    const root = document.createElement('div')
    syncVisualViewportToCssVars(root)

    expect(root.style.getPropertyValue('--visual-viewport-height').trim()).toBe('500px')
    expect(root.style.getPropertyValue('--visual-viewport-width').trim()).toBe('390px')
    expect(root.style.getPropertyValue('--visual-viewport-offset-top').trim()).toBe('0px')
    expect(root.style.getPropertyValue('--visual-viewport-offset-left').trim()).toBe('0px')
    expect(root.style.getPropertyValue('--vh').trim()).toBe('5px')
  })

  it('applies small height changes (regression: old AppProviders skipped sub-50px deltas)', () => {
    const root = document.createElement('div')
    syncVisualViewportToCssVars(root)
    expect(root.style.getPropertyValue('--visual-viewport-height').trim()).toBe('500px')

    vv.height = 520
    syncVisualViewportToCssVars(root)
    expect(root.style.getPropertyValue('--visual-viewport-height').trim()).toBe('520px')
    expect(root.style.getPropertyValue('--vh').trim()).toBe('5.2px')
  })

  it('ceil fractional visualViewport heights to avoid subpixel shell gaps', () => {
    const root = document.createElement('div')
    vv.height = 500.2
    syncVisualViewportToCssVars(root)
    expect(root.style.getPropertyValue('--visual-viewport-height').trim()).toBe('501px')
    expect(root.style.getPropertyValue('--vh').trim()).toBe('5.01px')
  })

  it('maps visualViewport offsetTop/offsetLeft for iOS keyboard scroll shift', () => {
    const root = document.createElement('div')
    vv.offsetTop = 11.328125
    vv.offsetLeft = 0
    vv.width = 393
    vv.height = 388.65625
    syncVisualViewportToCssVars(root)
    expect(root.style.getPropertyValue('--visual-viewport-offset-top').trim()).toBe('11.328125px')
    expect(root.style.getPropertyValue('--visual-viewport-width').trim()).toBe('393px')
    expect(root.style.getPropertyValue('--visual-viewport-height').trim()).toBe('389px')
  })

  it('no-ops when visualViewport is missing', () => {
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: null
    })
    const root = document.createElement('div')
    syncVisualViewportToCssVars(root)
    expect(root.style.getPropertyValue('--visual-viewport-height')).toBe('')
  })
})
