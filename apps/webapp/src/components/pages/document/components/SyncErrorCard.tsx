import { Icons } from '@icons'
import { twMerge } from 'tailwind-merge'

// Condition is derived live from store state in EditorContent, so a later onSynced
// self-heals this card without user action while Hocuspocus keeps auto-reconnecting.
const SyncErrorCard = ({ offline, className }: { offline?: boolean; className?: string }) => {
  return (
    <div
      role="alert"
      className={twMerge(
        'ProseMirror tiptap__editor flex w-full flex-col items-center justify-center gap-3 py-16 text-center',
        className
      )}>
      <Icons.cloudOff size={32} className="text-base-content/40" />
      <p className="text-base-content font-medium">
        {offline ? "You're offline" : "Can't reach the document server"}
      </p>
      <p className="text-base-content/60 text-sm">
        We keep retrying automatically — check your connection.
      </p>
      <button className="btn btn-primary btn-sm mt-2" onClick={() => window.location.reload()}>
        Reload
      </button>
    </div>
  )
}

export default SyncErrorCard
