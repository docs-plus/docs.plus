import { enableMapSet } from 'immer'
import { create } from 'zustand'

import dialogStore from './dialogStore'
import history from './history'
import notification from './notification'
import usersPresence from './usersPresence'
import virtualKeyboardStore from './virtualKeyboardStore'
import workspaceStore from './workspace'

enableMapSet()

interface IStore
  extends
    ReturnType<typeof usersPresence>,
    ReturnType<typeof workspaceStore>,
    ReturnType<typeof notification>,
    ReturnType<typeof history>,
    ReturnType<typeof virtualKeyboardStore>,
    ReturnType<typeof dialogStore> {}

export const useStore = create<IStore>((...props) => ({
  ...workspaceStore(...props),
  ...usersPresence(...props),
  ...history(...props),
  ...notification(...props),
  ...virtualKeyboardStore(...props),
  ...dialogStore(...props)
}))
