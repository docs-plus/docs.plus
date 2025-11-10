export const LoadingSpinner = ({ show }: { show: boolean }) => {
  if (!show) return null
  return (
    <div className="flex flex-col items-center justify-center space-y-3 py-8">
      <div className="loading loading-spinner loading-md"></div>
      <p className="text-sm text-gray-500">Loading bookmarks...</p>
    </div>
  )
}
