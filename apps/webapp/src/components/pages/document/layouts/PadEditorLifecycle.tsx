import type { HocuspocusProvider } from '@hocuspocus/provider'
import useEditorAndProvider from '@hooks/useEditorAndProvider'

const PadEditorLifecycle = ({ provider }: { provider: HocuspocusProvider }) => {
  useEditorAndProvider({ provider })
  return null
}

export default PadEditorLifecycle
