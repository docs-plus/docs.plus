import { create } from 'zustand'
import { enableMapSet } from 'immer'

import usersPresence from './usersPresence'
import workspaceStore from './workspace'
import chatRoom from './chat/chatroom'
import history from './history'
import notification from './notification'
import virtualKeyboardStore from './virtualKeyboardStore'

enableMapSet()

interface IStore
  extends ReturnType<typeof usersPresence>,
    ReturnType<typeof workspaceStore>,
    ReturnType<typeof chatRoom>,
    ReturnType<typeof notification>,
    ReturnType<typeof history>,
    ReturnType<typeof virtualKeyboardStore> {}

export const useStore = create<IStore>((...props) => ({
  ...workspaceStore(...props),
  ...usersPresence(...props),
  ...chatRoom(...props),
  ...history(...props),
  ...notification(...props),
  ...virtualKeyboardStore(...props)
}))
