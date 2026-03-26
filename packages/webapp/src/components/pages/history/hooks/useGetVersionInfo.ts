import { useStore } from '@stores'
import { useCallback } from 'react'

export const useGetVersionInfo = () => {
  const activeHistory = useStore((state) => state.activeHistory)
  const historyList = useStore((state) => state.historyList)
  return useCallback(() => {
    if (!activeHistory || !historyList.length) return null
    const versionInfo = historyList.find((item) => item.version === activeHistory.version)
    if (!versionInfo) return null

    return {
      ...versionInfo,
      isLatestVersion: historyList[0]?.version === activeHistory.version
    }
  }, [activeHistory, historyList])
}
