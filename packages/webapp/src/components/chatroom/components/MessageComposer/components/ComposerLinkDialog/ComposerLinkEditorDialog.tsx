import { KEYBOARD_DISMISS_DELAY_MS } from '@components/TipTap/hyperlinkPopovers/previewHyperlink'
import type { HyperlinkResult } from '@components/TipTap/hyperlinkPopovers/types'
import { normalizeHref, validateURL } from '@docs.plus/extension-hyperlink'
import { type FormEvent, useId, useLayoutEffect, useRef, useState } from 'react'

import { useComposerLinkDialogStore } from '../../stores/composerLinkDialogStore'
import { ComposerLinkModalShell } from './ComposerLinkModalShell'

type Props = {
  initialHref: string
  initialText: string
  /** True when this edit was opened from preview (href focus may defer). */
  cameFromPreview?: boolean
  validate?: (url: string) => boolean
  onSave: (result: HyperlinkResult) => boolean
  onCancel: () => void
}

export function ComposerLinkEditorDialog({
  initialHref,
  initialText,
  cameFromPreview = false,
  validate,
  onSave,
  onCancel
}: Props) {
  const titleId = useId()
  const [href, setHref] = useState(initialHref)
  const [text, setText] = useState(initialText)
  const [showError, setShowError] = useState(false)
  const hrefRef = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => {
    const focusHref = () => hrefRef.current?.focus()
    const deferFocus =
      cameFromPreview && !useComposerLinkDialogStore.getState().keyboardWasOpenAtOpen
    if (!deferFocus) {
      focusHref()
      return
    }
    const id = window.setTimeout(focusHref, KEYBOARD_DISMISS_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [cameFromPreview])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const raw = href.trim()
    if (!validateURL(raw, { customValidator: validate })) {
      setShowError(true)
      return
    }
    const ok = onSave({ href: normalizeHref(raw), text: text.trim() || undefined })
    if (ok === false) setShowError(true)
  }

  return (
    <ComposerLinkModalShell titleId={titleId} onBackdropClick={onCancel}>
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-3">
        <h2 id={titleId} className="text-lg font-semibold">
          Link
        </h2>
        <label className="form-control">
          <span className="label-text mb-1">Text</span>
          <input
            type="text"
            className="input input-bordered w-full"
            value={text}
            onChange={(e) => setText(e.target.value)}
            data-testid="composer-link-editor-text"
          />
        </label>
        <label className="form-control">
          <span className="label-text mb-1">Link</span>
          <input
            ref={hrefRef}
            type="url"
            inputMode="url"
            autoCapitalize="off"
            spellCheck={false}
            className={`input input-bordered input-primary w-full ${showError ? 'input-error' : ''}`}
            value={href}
            onChange={(e) => {
              setHref(e.target.value)
              if (showError) setShowError(false)
            }}
            data-testid="composer-link-editor-url"
          />
        </label>
        {showError && <span className="text-error text-xs">Please enter a valid URL</span>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!href.trim()}>
            Save
          </button>
        </div>
      </form>
    </ComposerLinkModalShell>
  )
}
