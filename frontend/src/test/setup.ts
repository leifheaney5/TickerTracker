import '@testing-library/jest-dom'

// jsdom does not implement window.matchMedia — provide a stub so components
// that call useIsMobile (which uses matchMedia) don't throw.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

// jsdom does not implement ResizeObserver — provide a no-op stub so components
// that observe element size (e.g. the Crypto map) don't throw on mount.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub
