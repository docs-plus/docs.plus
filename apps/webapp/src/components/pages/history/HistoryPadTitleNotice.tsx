import type { PadTitleChangeNotice } from './types'

type HistoryEditorVariant = 'desktop' | 'mobile'

const WRAP: Record<HistoryEditorVariant, string> = {
  desktop: 'mt-4 mb-2 w-full max-w-4xl px-6 sm:px-8',
  mobile: 'mx-3 mt-3 mb-2'
}

export function HistoryPadTitleNotice({
  notice,
  variant
}: {
  notice: PadTitleChangeNotice
  variant: HistoryEditorVariant
}) {
  return (
    <div role="status" className={WRAP[variant]}>
      <div className="rounded-box border-base-300 bg-base-100 border px-4 py-2 text-sm leading-snug">
        <p className="text-base-content">
          <span className="font-semibold">
            {notice.userName === 'someone' ? 'someone' : `@${notice.userName}`}
          </span>
          <span className="text-base-content/75"> renamed this document</span>
        </p>
        <p className="text-base-content mt-1 min-w-0 break-words">
          <span className="font-medium">&ldquo;{notice.titleFrom}&rdquo;</span>
          <span aria-hidden className="text-base-content/50 mx-1.5">
            →
          </span>
          <span className="font-medium">&ldquo;{notice.titleTo}&rdquo;</span>
        </p>
      </div>
    </div>
  )
}
