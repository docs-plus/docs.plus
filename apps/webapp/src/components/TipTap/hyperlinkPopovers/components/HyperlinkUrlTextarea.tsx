import type { KeyboardEvent, RefObject } from 'react'
import { twMerge } from 'tailwind-merge'

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
}

/** Auto-growing URL field: strips whitespace on input and merges clean paste text. */
export function HyperlinkUrlTextarea({
  value,
  onCommit,
  inputRef,
  testId,
  placeholder = 'Paste a link or pick a target',
  className,
  onKeyDown,
  combobox
}: HyperlinkUrlTextareaProps) {
  return (
    <textarea
      ref={inputRef}
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
      aria-multiline="false"
      className={twMerge('field-sizing-content max-h-24 resize-none leading-snug', className)}
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
