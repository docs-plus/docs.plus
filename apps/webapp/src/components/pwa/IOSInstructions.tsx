import { LuShare, LuSquarePlus, LuX } from 'react-icons/lu'

export function IOSInstructions({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 rounded-field p-2">
            <LuSquarePlus size={24} className="text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Add to Home Screen</h3>
            <p className="text-xs opacity-60">Follow these steps in Safari</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="hover:bg-base-content/10 rounded-field -mt-1 -mr-2 cursor-pointer p-1.5 opacity-60 transition-[opacity,background-color] hover:opacity-100"
          aria-label="Dismiss">
          <LuX size={16} />
        </button>
      </div>

      <ol className="flex flex-col gap-3">
        <li className="flex items-center gap-3">
          <div className="bg-base-content/10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
            1
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span>Tap</span>
            <LuShare size={18} className="text-primary" />
            <span className="opacity-70">in Safari&apos;s toolbar</span>
          </div>
        </li>
        <li className="flex items-center gap-3">
          <div className="bg-base-content/10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
            2
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span>Scroll down, tap</span>
            <LuSquarePlus size={18} className="text-primary" />
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
          className="text-primary cursor-pointer text-sm font-medium hover:underline">
          ← Back
        </button>
      </div>
    </>
  )
}
