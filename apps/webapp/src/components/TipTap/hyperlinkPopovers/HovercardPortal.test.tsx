import { act, createEvent, fireEvent, render, within } from '@testing-library/react'

import { HovercardPortal, mountHovercardView } from './HovercardPortal'

// The engine places the card as soon as `render` returns, and a view left in the store
// would keep a dead card's React tree alive for the life of the pad.
describe('mountHovercardView', () => {
  test('draws at once, and destroy unmounts only its own view', () => {
    render(<HovercardPortal />)

    const first = mountHovercardView(
      <span>
        first<button type="button">go</button>
      </span>
    )
    expect(first.element.textContent).toBe('firstgo')
    // Every card button relies on this to keep the caret in the editor.
    const button = within(first.element).getByRole('button')
    const press = createEvent.mouseDown(button)
    fireEvent(button, press)
    expect(press.defaultPrevented).toBe(true)

    const second = mountHovercardView(<span>second</span>)
    act(() => second.destroy?.())
    expect(second.element.textContent).toBe('')
    expect(first.element.textContent).toBe('firstgo')

    act(() => first.destroy?.())
    expect(first.element.textContent).toBe('')
  })
})
