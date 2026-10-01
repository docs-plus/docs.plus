import { LuShare, LuSquarePlus } from 'react-icons/lu'

import { PromptHeader } from './PromptHeader'

type IOSInstructionsProps = {
  titleId: string
  descId: string
  onBack: () => void
  onClose: () => void
}

export function IOSInstructions({ titleId, descId, onBack, onClose }: IOSInstructionsProps) {
  return (
    <>
      <PromptHeader
        icon={LuSquarePlus}
        title="Add to Home Screen"
        subtitle="Follow these steps in Safari"
        titleId={titleId}
        closeLabel="Dismiss"
        onClose={onClose}
      />

      <ol id={descId} className="flex flex-col gap-3">
        <li className="flex items-center gap-3">
          <div className="bg-base-content/10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
            1
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span>Tap</span>
            <LuShare size={18} aria-label="Share" role="img" />
            <span className="opacity-70">in Safari&apos;s toolbar</span>
          </div>
        </li>
        <li className="flex items-center gap-3">
          <div className="bg-base-content/10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
            2
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span>Scroll down, tap</span>
            <LuSquarePlus size={18} aria-hidden />
            <span className="font-medium">&quot;Add to Home Screen&quot;</span>
          </div>
        </li>
        <li className="flex items-center gap-3">
          <div className="bg-base-content/10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
            3
          </div>
          <span className="text-sm">
            Tap <span className="font-medium">&quot;Add&quot;</span> — then open from Home Screen
          </span>
        </li>
      </ol>

      <div className="flex justify-end pt-1">
        <button
          onClick={onBack}
          className="rounded-field -mx-2 -my-2.5 inline-flex cursor-pointer items-center gap-1 px-2 py-2.5 text-sm font-semibold hover:underline focus-visible:ring-2 focus-visible:ring-current focus-visible:outline-none">
          <span aria-hidden="true">←</span>
          Back
        </button>
      </div>
    </>
  )
}
