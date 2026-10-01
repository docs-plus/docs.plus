import Button from '@components/ui/Button'

import { SheetFooter } from './SheetFooter'

type SheetPrimaryFooterProps = {
  label: string
  onClick: () => void
  disabled?: boolean
  /** Busy action: the button keeps its label beside a spinner and is disabled. */
  loading?: boolean
  testId?: string
}

export function SheetPrimaryFooter({
  label,
  onClick,
  disabled = false,
  loading = false,
  testId
}: SheetPrimaryFooterProps) {
  return (
    <SheetFooter>
      <Button
        variant="primary"
        onClick={onClick}
        disabled={disabled}
        loading={loading}
        data-testid={testId}
        className="min-h-12 w-full text-base font-semibold">
        {label}
      </Button>
    </SheetFooter>
  )
}
