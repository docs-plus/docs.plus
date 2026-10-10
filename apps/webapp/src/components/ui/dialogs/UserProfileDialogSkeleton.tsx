// Each bone sits in a line box of its real line height: the `text-xl` name is 28px, `text-sm` 20px.
export function UserProfileDialogHeaderSkeleton() {
  return (
    <>
      <div className="skeleton size-16 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <div className="flex h-7 items-center">
          <div className="skeleton h-5 w-48 max-w-full" />
        </div>
        <div className="flex h-5 items-center">
          <div className="skeleton h-3.5 w-28 max-w-full" />
        </div>
      </div>
    </>
  )
}

function ProfileLinkRowSkeleton({ withDescription }: { withDescription: boolean }) {
  return (
    <div className="-mx-2 flex items-center gap-3 px-2 py-1.5">
      <div className="skeleton size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex h-5 items-center">
          <div className="skeleton h-3.5 w-32" />
        </div>
        {withDescription && (
          <div className="flex h-5 items-center">
            <div className="skeleton h-3 w-24" />
          </div>
        )}
      </div>
    </div>
  )
}

const SectionHeadingSkeleton = ({ width }: { width: string }) => (
  <div className="mb-2 flex h-6 items-center">
    <div className={`skeleton h-4 ${width}`} />
  </div>
)

/** Mirrors the loaded body's geometry, so the swap does not shift the dialog. */
export function UserProfileDialogSkeleton() {
  return (
    <div className="space-y-4 p-6" aria-hidden>
      <div>
        <SectionHeadingSkeleton width="w-14" />
        {['w-full', 'w-[92%]', 'w-[78%]'].map((width) => (
          <div key={width} className="flex h-5 items-center">
            <div className={`skeleton h-3.5 ${width}`} />
          </div>
        ))}
      </div>

      <div>
        <SectionHeadingSkeleton width="w-12" />
        <div className="flex flex-col gap-2">
          <ProfileLinkRowSkeleton withDescription />
          <ProfileLinkRowSkeleton withDescription={false} />
        </div>
      </div>
    </div>
  )
}
