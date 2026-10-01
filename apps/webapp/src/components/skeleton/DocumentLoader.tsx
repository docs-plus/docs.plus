const DocumentLoader = ({ picture, className }: { picture?: boolean; className?: string }) => (
  <div className={className}>
    <div className="skeleton mb-3 h-7 w-3/5" />

    <div className="mb-4 flex gap-6">
      <div className="skeleton h-4 w-16" />
      <div className="skeleton h-4 w-28" />
    </div>

    <div className="space-y-3 pl-4">
      <div className="skeleton h-4 w-[94%]" />
      <div className="skeleton h-4 w-[40%]" />

      {picture ? (
        <div className="flex gap-4 py-2">
          <div className="skeleton rounded-box size-32 shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="skeleton h-4 w-[78%]" />
            <div className="skeleton h-4 w-[58%]" />
            <div className="skeleton h-4 w-[72%]" />
            <div className="skeleton h-4 w-[30%]" />
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          <div className="skeleton h-4 w-1/5" />
          <div className="skeleton h-4 w-[18%]" />
          <div className="skeleton h-4 w-2/5" />
        </div>
      )}

      <div className="skeleton h-4 w-[78%]" />
      <div className="skeleton h-4 w-[94%]" />
      <div className="skeleton h-4 w-[70%]" />
      <div className="skeleton h-4 w-[88%]" />
      <div className="skeleton h-4 w-1/2" />
    </div>
  </div>
)

export default DocumentLoader
