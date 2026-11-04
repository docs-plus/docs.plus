import { act, render } from '@testing-library/react'

import { HovercardPortal, mountHovercardView } from './HovercardPortal'

// The engine places the card as soon as `render` returns, and a view left in the store
// would keep a dead card's React tree alive for the life of the pad.
describe('mountHovercardView', () => {
  test('draws at once, and destroy unmounts only its own view', () => {
    render(<HovercardPortal />)

    const first = mountHovercardView(<span>first</span>)
    expect(first.element.textContent).toBe('first')

    const second = mountHovercardView(<span>second</span>)
    act(() => second.destroy?.())
    expect(second.element.textContent).toBe('')
    expect(first.element.textContent).toBe('first')

    act(() => first.destroy?.())
    expect(first.element.textContent).toBe('')
  })
})
