import { twMerge } from '@utils/twMerge'
import type { KeyboardEvent, RefObject } from 'react'

import { stripUrlFieldWhitespace, urlFieldPasteValue } from '../utils/urlFieldInput'

export type HyperlinkUrlTextareaComboboxProps = {
  expanded: boolean
  controls?: string
  activedescendant?: string
}

export type HyperlinkUrlTextareaProps = {
  value: string
  onCommit: (value: string) => void
  inputRef?: RefObject<HTMLTextAreaElement | null>
  testId: string
  placeholder?: string
  className?: string
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  combobox?: HyperlinkUrlTextareaComboboxProps
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

export function HyperlinkUrlTextarea({
  value,
  onCommit,
  inputRef,
  testId,
  placeholder = 'Paste a link or pick a target',
  className,
  onKeyDown,
  combobox,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy
}: HyperlinkUrlTextareaProps) {
  return (
    <textarea
      ref={inputRef}
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedBy}
      rows={1}
      inputMode="url"
      autoCapitalize="off"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onCommit(stripUrlFieldWhitespace(event.target.value))}
      onPaste={(event) => {
        const update = urlFieldPasteValue(
          event.currentTarget.value,
          event.clipboardData.getData('text'),
          event.currentTarget.selectionStart,
          event.currentTarget.selectionEnd
        )
        if (!update) return
        event.preventDefault()
        onCommit(update.value)
        const target = event.currentTarget
        requestAnimationFrame(() => target.setSelectionRange(update.caret, update.caret))
      }}
      onKeyDown={onKeyDown}
      data-testid={testId}
      className={twMerge('field-sizing-content max-h-24 resize-none leading-snug', className)}
      // A bare textarea keeps its native textbox role; axe rejects aria-multiline on it.
      {...(combobox
        ? {
            role: 'combobox' as const,
            'aria-autocomplete': 'list' as const,
            'aria-expanded': combobox.expanded,
            'aria-controls': combobox.expanded ? combobox.controls : undefined,
            'aria-activedescendant': combobox.activedescendant
          }
        : {})}
    />
  )
}
