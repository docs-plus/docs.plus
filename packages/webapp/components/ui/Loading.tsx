const Loading = ({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) => {
  return (
    <div className={`flex size-full items-center justify-center ${className}`}>
      <span className={`loading loading-spinner loading-${size}`}></span>
    </div>
  )
}
export default Loading
