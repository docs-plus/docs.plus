import { TextLine } from '@components/ui/TextLine'

// Each bone sits in a line box of its real line height: the `text-xl` name is 28px, `text-sm` 20px.
export function UserProfileDialogHeaderSkeleton() {
  return (
    <>
      <div className="skeleton size-16 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <TextLine box="h-7" bone="h-5 w-48 max-w-full" />
        <TextLine bone="h-3.5 w-28 max-w-full" />
      </div>
    </>
  )
}

function ProfileLinkRowSkeleton({ withDescription }: { withDescription: boolean }) {
  return (
    <div className="-mx-2 flex items-center gap-3 px-2 py-1.5">
      <div className="skeleton size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <TextLine bone="h-3.5 w-32" />
        {withDescription && <TextLine bone="h-3 w-24" />}
      </div>
    </div>
  )
}

/** Mirrors the loaded body's geometry, so the swap does not shift the dialog. */
export function UserProfileDialogSkeleton() {
  return (
    <div className="space-y-4 p-6" aria-hidden>
      <div>
        <TextLine box="h-6" bone="h-4 w-14" className="mb-2" />
        {['w-full', 'w-[92%]', 'w-[78%]'].map((width) => (
          <TextLine key={width} bone={`h-3.5 ${width}`} />
        ))}
      </div>

      <div>
        <TextLine box="h-6" bone="h-4 w-12" className="mb-2" />
        <div className="flex flex-col gap-2">
          <ProfileLinkRowSkeleton withDescription />
          <ProfileLinkRowSkeleton withDescription={false} />
        </div>
      </div>
    </div>
  )
}
