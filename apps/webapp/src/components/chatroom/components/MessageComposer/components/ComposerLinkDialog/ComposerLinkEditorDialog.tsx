import { HyperlinkUrlTextarea } from '@components/TipTap/hyperlinkPopovers/components/HyperlinkUrlTextarea'
import type { HyperlinkResult } from '@components/TipTap/hyperlinkPopovers/types'
import Button from '@components/ui/Button'
import { DialogActions } from '@components/ui/Dialog'
import { FieldHelp, fieldLabelClassName } from '@components/ui/FieldHelp'
import TextInput from '@components/ui/TextInput'
import { normalizeHref, validateURL } from '@docs.plus/extension-hyperlink'
import { type FormEvent, useId, useLayoutEffect, useRef, useState } from 'react'

import { ComposerLinkModalShell } from './ComposerLinkModalShell'

type Props = {
  initialHref: string
  initialText: string
  validate?: (url: string) => boolean
  onSave: (result: HyperlinkResult) => boolean
  onCancel: () => void
}

export function ComposerLinkEditorDialog({
  initialHref,
  initialText,
  validate,
  onSave,
  onCancel
}: Props) {
  const errorId = useId()
  const [href, setHref] = useState(initialHref)
  const [text, setText] = useState(initialText)
  const [showError, setShowError] = useState(false)
  const hrefRef = useRef<HTMLTextAreaElement>(null)

  const commitHref = (value: string) => {
    setHref(value)
    if (showError) setShowError(false)
  }

  // Synchronous, inside the opening tap: iOS shows the keyboard only for a
  // focus call made during a user gesture, never from a timer.
  useLayoutEffect(() => {
    hrefRef.current?.focus()
  }, [])

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
    <ComposerLinkModalShell title="Link" onBackdropClick={onCancel} size="md">
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextInput
          labelPosition="above"
          label="Text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          data-testid="composer-link-editor-text"
        />
        <div className="flex flex-col gap-1.5">
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabelClassName}>Link</span>
            <HyperlinkUrlTextarea
              inputRef={hrefRef}
              value={href}
              onCommit={commitHref}
              testId="composer-link-editor-url"
              placeholder="https://"
              className={`textarea min-h-10 w-full ${showError ? 'textarea-error' : ''}`}
              aria-invalid={showError || undefined}
              aria-describedby={showError ? errorId : undefined}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  e.currentTarget.form?.requestSubmit()
                }
              }}
            />
          </label>
          {showError && (
            <FieldHelp id={errorId} role="alert" error>
              Please enter a valid URL
            </FieldHelp>
          )}
        </div>
        <DialogActions>
          <Button variant="cancel" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Save link
          </Button>
        </DialogActions>
      </form>
    </ComposerLinkModalShell>
  )
}
