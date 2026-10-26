import { useHistoryDismiss } from '@hooks/useHistoryDismiss'
import { useChatStore, useStore } from '@stores'
import { act, renderHook } from '@testing-library/react'

import { useChatPaneHistory } from './useChatPaneHistory'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

beforeEach(() => {
  window.history.replaceState(null, '', '/pad')
  useStore.getState().setWorkspaceEditorSetting('isMobile', true)
})

afterEach(() => {
  jest.restoreAllMocks()
})

// #639: Safari lands the drawer's history.back() about 90 ms after the tap. A pane that
// pushed its entry before that landing lost it to the pop and closed the room at once.
it('keeps the chat open when the TOC drawer closes in the same tap', async () => {
  const destroyChatRoom = jest.fn()
  jest.spyOn(useChatStore, 'getState').mockReturnValue({
    ...useChatStore.getState(),
    destroyChatRoom
  })
  const drawer = renderHook(({ open }) => useHistoryDismiss(open, () => {}), {
    initialProps: { open: true }
  })
  expect(window.history.state).toEqual({ historyDismiss: true })

  const back = window.history.back.bind(window.history)
  jest.spyOn(window.history, 'back').mockImplementation(() => {
    setTimeout(back, 50)
  })

  await act(async () => {
    drawer.rerender({ open: false })
    renderHook(() => useChatPaneHistory(true))
  })
  await act(() => sleep(200))

  expect(destroyChatRoom).not.toHaveBeenCalled()
  expect(window.history.state).toEqual({ chatPane: true })
})
