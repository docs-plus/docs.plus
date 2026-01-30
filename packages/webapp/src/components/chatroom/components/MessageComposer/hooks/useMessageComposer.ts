import { useContext } from 'react'

import {
  MessageComposerContext,
  MessageComposerContextType
} from '../context/MessageComposerContext'

export const useMessageComposer = (): MessageComposerContextType => {
  const context = useContext(MessageComposerContext)

  if (!context) {
    throw new Error('useMessageComposer must be used within a MessageComposerContext.Provider')
  }

  return context
}
