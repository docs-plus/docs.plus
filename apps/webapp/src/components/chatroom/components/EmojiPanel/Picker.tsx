import { EmptyState } from '@components/ui/EmptyState'
import { Loading } from '@components/ui/Loading'
import { loadEmojiData } from '@utils/ensureEmojiData'
import dynamic, { type DynamicOptionsLoadingProps } from 'next/dynamic'

import { useEmojiPanelContext } from './context/EmojiPanelContext'
import type { EmojiMartPickerProps } from './EmojiMartPicker'

type PickerProps = Omit<EmojiMartPickerProps, 'data'>

// BottomSheet mounts on every route, so emoji-mart and its data load only when a picker mounts.
// The body gets the resolved data object: a data function makes emoji-mart await before it
// claims its shared set, and two inits in that gap would both change it.
const EmojiMartPicker = dynamic<PickerProps>(
  () =>
    Promise.all([import('./EmojiMartPicker'), loadEmojiData()]).then(([module, data]) => {
      const LoadedPicker = (props: PickerProps) => <module.EmojiMartPicker {...props} data={data} />
      return LoadedPicker
    }),
  { ssr: false, loading: PickerFallback }
)

function PickerFallback({ error, retry }: DynamicOptionsLoadingProps) {
  const { variant } = useEmojiPanelContext()
  const body = error ? (
    <EmptyState
      tone="error"
      title="Couldn’t load emoji."
      onRetry={retry}
      className="flex-1 justify-center"
    />
  ) : (
    <Loading label="Loading emoji" className="flex-1" />
  )
  if (variant !== 'desktop') return body
  // The desktop host has no frame of its own, so the fallback draws the emoji-mart card:
  // 9 × 36px emoji plus 28px of padding, a 1px border and a 435px host.
  return (
    <div className="rounded-box border-base-300 bg-base-100 flex h-[435px] w-[354px] flex-col border shadow-[var(--shadow-overlay)]">
      {body}
    </div>
  )
}

// emoji-mart 5.6 sizes its host at a fixed 435px. The fallback holds that height, so a
// content-detent sheet does not grow when the picker paints.
export const Picker = ({ emojiSelectHandler }: PickerProps) => (
  <div className="flex min-h-[435px] flex-col">
    <EmojiMartPicker emojiSelectHandler={emojiSelectHandler} />
  </div>
)
