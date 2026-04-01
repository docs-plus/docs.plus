import { twMerge } from 'tailwind-merge'

const ToolbarDivider = ({ className }: { className?: string }) => (
  <div className={twMerge('bg-base-300 mx-2 h-5 w-px shrink-0', className)} aria-hidden />
)

export default ToolbarDivider
