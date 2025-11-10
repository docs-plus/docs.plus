import { useCallback } from 'react'
import { getContentFromYdocObject } from '../helpers'
import { useStore } from '@stores'
import { useVersionContent } from './useVersionContent'

export const useStatelessMessage = () => {
  const { setHistoryList, setActiveHistory, setLoadingHistory, editor } = useStore((state) => state)
  const { watchVersionContent } = useVersionContent()

  const handleStatelessMessage = useCallback(
    (event: { payload: string }) => {
      const payloadData = JSON.parse(event.payload)

      if (payloadData.msg !== 'history.response') return

      if (payloadData.type === 'history.list') {
        // pick the latest version
        const latestVersion = payloadData.response.at(0)
        setHistoryList(payloadData.response)
        setActiveHistory(latestVersion)
        watchVersionContent(latestVersion.version)
        setLoadingHistory(false)
      }

      if (payloadData.type === 'history.watch') {
        setActiveHistory(payloadData.response)
        try {
          const prosemirrorJson = getContentFromYdocObject(payloadData.response.data)
          if (prosemirrorJson && editor) {
            editor.commands.setContent(prosemirrorJson)
          }
        } catch (error) {
          console.error('Error processing version:', error)
        } finally {
          setLoadingHistory(false)
        }
      }
    },
    [editor]
  )

  return { handleStatelessMessage }
}
