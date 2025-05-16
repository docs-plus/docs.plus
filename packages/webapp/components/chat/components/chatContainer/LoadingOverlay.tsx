export const LoadingOverlay = ({ loading }: { loading: boolean }) => {
  if (!loading) return null

  return (
    <div
      className="bg-base-100 absolute z-50 flex size-full items-center justify-center"
      style={{ display: loading ? 'flex' : 'none' }}>
      <div className="flex w-full items-center justify-center">
        <span className="loading loading-spinner text-primary"></span>
      </div>
    </div>
  )
}
