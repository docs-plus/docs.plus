import { useHistoryDismiss } from '@hooks/useHistoryDismiss'
import { useStore } from '@stores'
import { act, renderHook } from '@testing-library/react'

import { padUrl } from './padUrl'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

beforeEach(() => {
  window.history.replaceState(null, '', '/pad')
  useStore.getState().setWorkspaceEditorSetting('isMobile', true)
})

afterEach(() => {
  jest.restoreAllMocks()
})

// #639: a TOC tap in the phone drawer calls `go` before React commits the drawer close.
// Safari lands the drawer's history.back() about 90 ms later; a write before it is lost.
it('keeps the heading id when the TOC drawer closes in the same tap', async () => {
  const drawer = renderHook(({ open }) => useHistoryDismiss(open, () => {}), {
    initialProps: { open: true }
  })
  expect(window.history.state).toEqual({ historyDismiss: true })

  const back = window.history.back.bind(window.history)
  jest.spyOn(window.history, 'back').mockImplementation(() => {
    setTimeout(back, 50)
  })

  await act(async () => {
    void padUrl.go({ kind: 'heading', headingId: 'h1' })
    drawer.rerender({ open: false })
  })
  await act(() => sleep(200))

  expect(new URLSearchParams(window.location.search).get('id')).toBe('h1')
})
