export const LoadingSpinner = ({ position }: { position: 'top' | 'bottom' }) => (
  <div className={`absolute ${position}-4 pointer-events-none left-1/2 z-50 -translate-x-1/2`}>
    <span className="loading loading-spinner loading-sm text-primary"></span>
  </div>
)
