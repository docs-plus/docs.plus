import { Icons } from '@components/icons/registry'
import { SheetFooter } from '@components/SheetFooter'
import Button from '@components/ui/Button'

type SheetActionFooterProps = {
  primaryLabel?: string
  primaryDisabled?: boolean
  /** Busy submit: Apply keeps its label beside a spinner and is disabled. Back stays usable. */
  loading?: boolean
  onBack?: () => void
  backTestId?: string
  submitTestId?: string
}

export function SheetActionFooter({
  primaryLabel = 'Apply',
  primaryDisabled = false,
  loading = false,
  onBack,
  backTestId,
  submitTestId
}: SheetActionFooterProps) {
  return (
    <SheetFooter>
      <div className="flex gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            data-testid={backTestId}
            className="btn btn-ghost btn-square min-h-12 w-12 shrink-0">
            <Icons.back size={20} aria-hidden />
          </button>
        )}
        <Button
          type="submit"
          variant="primary"
          disabled={primaryDisabled}
          loading={loading}
          data-testid={submitTestId}
          className="min-h-12 flex-1 text-base font-semibold">
          {primaryLabel}
        </Button>
      </div>
    </SheetFooter>
  )
}
