import { twMerge } from 'tailwind-merge'

type Props = {
  dataKey: string
  ariaLabel: string
  widthClass: string
  onJump: () => void
  children: React.ReactNode
}

export function ReferenceJumpButton({ dataKey, ariaLabel, widthClass, onJump, children }: Props) {
  return (
    <button
      type="button"
      data-key={dataKey}
      aria-label={ariaLabel}
      className={twMerge(
        'bg-base-200 text-base-content border-info hover:bg-base-300/60 focus-visible:ring-primary relative z-[1] mb-1 block cursor-pointer rounded border-l-4 p-1 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none',
        widthClass
      )}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onJump()
      }}>
      {children}
    </button>
  )
}
