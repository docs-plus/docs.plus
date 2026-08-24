import { SheetFooter } from './SheetFooter'

type SheetPrimaryFooterProps = {
  label: string
  onClick: () => void
  disabled?: boolean
  testId?: string
}

export function SheetPrimaryFooter({
  label,
  onClick,
  disabled = false,
  testId
}: SheetPrimaryFooterProps) {
  return (
    <SheetFooter>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        data-testid={testId}
        className="btn btn-primary min-h-12 w-full text-base font-semibold">
        {label}
      </button>
    </SheetFooter>
  )
}
