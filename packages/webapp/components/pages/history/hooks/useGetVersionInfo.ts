import { useCallback } from 'react'
import { useStore } from '@stores'

export const useGetVersionInfo = () => {
  const { activeHistory, historyList } = useStore((state) => state)
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
