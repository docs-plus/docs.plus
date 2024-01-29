export const LoadingOverlay = ({ loading }: any) => {
  if (!loading) return null
  return (
    <div
      className="absolute z-20 h-full flex  w-full items-center justify-center bg-base-100"
      style={{ display: loading ? 'flex' : 'none' }}>
      <div className="flex  w-full items-center justify-center">
        <span className="loading loading-spinner text-primary"></span>
      </div>
    </div>
  )
}
