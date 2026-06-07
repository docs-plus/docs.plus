import { Icons } from '@components/icons/registry'
import { SheetFooter } from '@components/SheetFooter'

type SheetActionFooterProps = {
  primaryLabel?: string
  primaryDisabled?: boolean
  onBack?: () => void
  backTestId?: string
  submitTestId?: string
}

/** Form footer: optional back (left) + primary submit (flex-1). */
export function SheetActionFooter({
  primaryLabel = 'Apply',
  primaryDisabled = false,
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
        <button
          type="submit"
          disabled={primaryDisabled}
          data-testid={submitTestId}
          className="btn btn-primary min-h-12 flex-1 text-base font-semibold">
          {primaryLabel}
        </button>
      </div>
    </SheetFooter>
  )
}
