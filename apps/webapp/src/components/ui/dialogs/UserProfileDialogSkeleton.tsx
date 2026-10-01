export function UserProfileDialogHeaderSkeleton() {
  return (
    <>
      <div className="skeleton size-16 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="skeleton h-6 w-48 max-w-full" />
        <div className="skeleton h-3.5 w-28 max-w-full" />
      </div>
    </>
  )
}

function ProfileLinkRowSkeleton({ withDescription }: { withDescription: boolean }) {
  return (
    <div className="-mx-2 flex items-center gap-3 px-2 py-1.5">
      <div className="skeleton size-5 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="skeleton h-3.5 w-32" />
        {withDescription && <div className="skeleton h-3 w-24" />}
      </div>
    </div>
  )
}

/** Mirrors the loaded body's geometry, so the swap does not shift the dialog. */
export function UserProfileDialogSkeleton() {
  return (
    <div
      className="space-y-4 p-6 motion-safe:animate-[doc-content-in_120ms_ease-out_both]"
      aria-hidden>
      <div>
        <div className="skeleton mb-3 h-4 w-14" />
        <div className="space-y-2">
          <div className="skeleton h-3.5 w-full" />
          <div className="skeleton h-3.5 w-[92%]" />
          <div className="skeleton h-3.5 w-[78%]" />
        </div>
      </div>

      <div>
        <div className="skeleton mb-3 h-4 w-12" />
        <div className="flex flex-col gap-2">
          <ProfileLinkRowSkeleton withDescription />
          <ProfileLinkRowSkeleton withDescription={false} />
        </div>
      </div>
    </div>
  )
}
