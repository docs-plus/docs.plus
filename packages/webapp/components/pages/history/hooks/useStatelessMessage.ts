import { useCallback } from 'react'
import { Editor } from '@tiptap/react'
import { getContentFromYdocObject } from '../DesktopHistory'

interface UseStatelessMessageProps {
  editor: Editor | null
  setHistory: (history: any[]) => void
  setCurrentVersion: (version: number | null) => void
  watchVersionContent: (version: number) => void
  setIsLoading: (loading: boolean) => void
  setCurrentVersionContent: (content: any) => void
  setError: (error: string | null) => void
}

export const useStatelessMessage = ({
  editor,
  setHistory,
  setCurrentVersion,
  watchVersionContent,
  setIsLoading,
  setCurrentVersionContent,
  setError
}: UseStatelessMessageProps) => {
  const handleStatelessMessage = useCallback(
    (event: { payload: string }) => {
      const payloadData = JSON.parse(event.payload)

      if (payloadData.msg === 'history.response') {
        if (payloadData.type === 'history.list') {
          setHistory(payloadData.response)
          const latestVersion = payloadData.response[0]
          setCurrentVersion(latestVersion.version)
          watchVersionContent(latestVersion.version)
        }

        if (payloadData.type === 'history.watch') {
          setIsLoading(true)
          setCurrentVersionContent(payloadData.response.data)
          try {
            const prosemirrorJson = getContentFromYdocObject(payloadData.response.data)
            if (prosemirrorJson && editor) {
              setCurrentVersionContent(prosemirrorJson)
              editor.commands.setContent(prosemirrorJson)
            }
          } catch (error) {
            console.error('Error processing version:', error)
            // @ts-ignore
            setError(error.message)
          } finally {
            setIsLoading(false)
          }
          setIsLoading(false)
        }
      }
    },
    [
      editor,
      setHistory,
      setCurrentVersion,
      watchVersionContent,
      setIsLoading,
      setCurrentVersionContent,
      setError
    ]
  )

  return { handleStatelessMessage }
}
