const Loading = ({ className }: { className?: string }) => {
  return (
    <div className={`flex size-full items-center justify-center ${className}`}>
      <span className="loading loading-spinner loading-md"></span>
    </div>
  )
}
export default Loading
