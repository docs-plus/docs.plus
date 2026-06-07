import '@testing-library/jest-dom'

// jsdom does not implement matchMedia; provide a no-op stub so modules
// that probe `prefers-color-scheme` etc. on import do not throw under Jest.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({
      matches: false,
      media: '',
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false
    })
  })
}
