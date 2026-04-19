import { Icons } from '@components/icons/registry'
import { normalizeHref, validateURL } from '@docs.plus/extension-hyperlink'
import { type SheetDataMap, useSheetStore } from '@stores'
import { useEffect, useId, useRef, useState } from 'react'

interface LinkEditorSheetProps {
  data: SheetDataMap['linkEditor']
}

const AUTOFOCUS_DELAY_MS = 50

/**
 * Mobile bottom-sheet form for adding or editing a hyperlink. Mounted
 * by `BottomSheet.tsx` whenever `useSheetStore.activeSheet === 'linkEditor'`,
 * which passes the sheet payload (`mode`, `initialHref`, `onSubmit`,
 * `validate`, `onBack`) as props.
 *
 * The submit/validate callbacks come from whoever opened the sheet —
 * the Tiptap extension's `createHyperlink` factory (Add Link toolbar /
 * Cmd+K), or the preview sheet's "Edit" action — so this component
 * stays agnostic of editor commands. When `onBack` is provided, a back
 * arrow replaces the Cancel button (back implicitly cancels).
 */
const LinkEditorSheet = ({ data: payload }: LinkEditorSheetProps) => {
  const closeSheet = useSheetStore((s) => s.closeSheet)
  const { mode, initialHref, onSubmit, validate, onBack } = payload

  const inputId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [draftHref, setDraftHref] = useState(initialHref)
  const [showError, setShowError] = useState(false)

  // Open the virtual keyboard one step after the slide-in animation
  // settles. Without the rAF + small delay, the focus races the
  // framer-motion enter and is dropped by iOS Safari.
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const rafId = requestAnimationFrame(() => {
      timeoutId = setTimeout(() => {
        inputRef.current?.focus()
        if (mode === 'edit' && initialHref) inputRef.current?.select()
      }, AUTOFOCUS_DELAY_MS)
    })
    return () => {
      cancelAnimationFrame(rafId)
      if (timeoutId !== undefined) clearTimeout(timeoutId)
    }
  }, [mode, initialHref])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const raw = draftHref.trim()
    if (!validateURL(raw, { customValidator: validate })) {
      setShowError(true)
      return
    }
    onSubmit(normalizeHref(raw))
    closeSheet()
  }

  const isApplyDisabled = !draftHref.trim()
  const title = mode === 'create' ? 'Add link' : 'Edit link'
  const submitLabel = mode === 'create' ? 'Add link' : 'Update'

  return (
    // `noValidate` lets our `validateURL` (stricter than the browser's
    // built-in `type="url"` check) own the error UX without the native
    // balloon firing first. We keep `type="url"` for the mobile
    // keyboard hint.
    <form
      noValidate
      onSubmit={handleSubmit}
      className="bg-base-100 flex flex-col gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center gap-1 pb-1">
        {onBack && (
          // 44px tap target (iOS HIG minimum); `-ml-2` keeps the icon
          // optically aligned with the form's left edge.
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to link preview"
            className="text-base-content hover:bg-base-200 active:bg-base-200 -ml-2 inline-flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors">
            <Icons.back size={22} />
          </button>
        )}
        <h3 className="text-base-content m-0 text-base font-semibold">{title}</h3>
      </header>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={inputId}
          className="text-base-content/70 text-xs font-medium tracking-wide uppercase">
          URL
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="url"
          inputMode="url"
          autoCapitalize="off"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://example.com"
          value={draftHref}
          onChange={(event) => {
            setDraftHref(event.target.value)
            if (showError) setShowError(false)
          }}
          className={`border-base-300 bg-base-100 text-base-content focus:border-primary focus:ring-primary w-full rounded-lg border px-3.5 py-3 text-base outline-none focus:ring-1 ${
            showError ? 'border-error ring-error ring-1' : ''
          }`}
        />
        {showError && (
          <span className="text-error text-xs font-medium">Please enter a valid URL</span>
        )}
      </div>
      <footer className="flex gap-2 pt-1">
        {/* When `onBack` exists, the header back arrow already cancels;
            a second Cancel here would dilute the primary action. */}
        {!onBack && (
          <button
            type="button"
            onClick={closeSheet}
            className="text-base-content hover:bg-base-200 min-h-12 min-w-[5.5rem] rounded-lg px-4 text-base font-medium transition-colors">
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isApplyDisabled}
          className="bg-primary text-primary-content hover:bg-primary/90 min-h-12 flex-1 rounded-lg px-4 text-base font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50">
          {submitLabel}
        </button>
      </footer>
    </form>
  )
}

export default LinkEditorSheet
