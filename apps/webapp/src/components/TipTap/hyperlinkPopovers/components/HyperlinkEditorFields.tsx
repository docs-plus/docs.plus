import { Icons } from '@components/icons/registry'
import { FieldHelp, fieldLabelClassName as uiFieldLabelClassName } from '@components/ui/FieldHelp'
import TextInput from '@components/ui/TextInput'
import type { ReactNode } from 'react'

import type { HyperlinkEditorForm } from '../hooks/useHyperlinkEditorForm'
import { HyperlinkSuggestions } from './HyperlinkSuggestions'
import { HyperlinkUrlTextarea } from './HyperlinkUrlTextarea'

type FieldProps = { form: HyperlinkEditorForm }

// The desktop popover is a compact anchored toolbar, so its labels are visually hidden.
const fieldLabelClassName = (isDesktop: boolean) => (isDesktop ? 'sr-only' : uiFieldLabelClassName)

export function HyperlinkEditorTextField({ form }: FieldProps): ReactNode {
  const { isCreate, isDesktop, text, textInputId, setText, setTextTouched } = form
  if (isCreate) return null

  return (
    <TextInput
      id={textInputId}
      label="Link text"
      labelPosition="above"
      labelClassName={fieldLabelClassName(isDesktop)}
      placeholder={isDesktop ? 'Link text' : undefined}
      value={text}
      startIcon={Icons.textFormat}
      iconSize={18}
      data-testid="hyperlink-editor-text"
      onChange={(event) => {
        setText(event.target.value)
        setTextTouched(true)
      }}
    />
  )
}

export function HyperlinkEditorUrlField({ form }: FieldProps): ReactNode {
  const {
    href,
    isDesktop,
    showError,
    errorId,
    inputRef,
    listboxMounted,
    listboxId,
    activeRowId,
    commitHref,
    handleKeyDown
  } = form

  return (
    <label className="flex w-full min-w-0 flex-col gap-1.5">
      <span className={fieldLabelClassName(isDesktop)}>URL</span>
      <div
        className={`input h-auto w-full min-w-0 items-start gap-2 py-1.5 ${showError ? 'input-error' : ''}`}>
        <span className="mt-0.5 flex size-[18px] shrink-0 items-center justify-center opacity-60">
          <Icons.link size={18} aria-hidden />
        </span>
        <HyperlinkUrlTextarea
          inputRef={inputRef}
          value={href}
          onCommit={commitHref}
          testId="hyperlink-editor-url"
          className="max-h-24 grow overflow-y-auto outline-none"
          onKeyDown={handleKeyDown}
          aria-invalid={showError || undefined}
          aria-describedby={showError ? errorId : undefined}
          combobox={{
            expanded: listboxMounted,
            controls: listboxMounted ? listboxId : undefined,
            activedescendant: activeRowId
          }}
        />
      </div>
    </label>
  )
}

export function HyperlinkEditorError({ form }: FieldProps): ReactNode {
  if (!form.showError) return null
  return (
    <FieldHelp id={form.errorId} role="alert" data-testid="hyperlink-editor-error" error>
      Please enter a valid URL
    </FieldHelp>
  )
}

export function HyperlinkEditorSuggestionList({ form }: FieldProps): ReactNode {
  const {
    variant,
    isDesktop,
    suggestionStateValue,
    headings,
    bookmarks,
    isLoading,
    applyPicked,
    expand,
    back,
    setHighlight,
    rowIdPrefix
  } = form

  return (
    <HyperlinkSuggestions
      variant={variant}
      panel={suggestionStateValue.panel}
      headings={headings}
      bookmarks={bookmarks}
      highlightIndex={suggestionStateValue.highlightIndex}
      isLoading={isLoading}
      onPick={applyPicked}
      onExpand={expand}
      onBack={isDesktop ? back : undefined}
      onRowHover={(i) => setHighlight(i)}
      rowIdPrefix={rowIdPrefix}
    />
  )
}

export function HyperlinkEditorFields({ form }: FieldProps): ReactNode {
  return (
    <>
      <HyperlinkEditorTextField form={form} />
      <HyperlinkEditorUrlField form={form} />
      <HyperlinkEditorError form={form} />
      <HyperlinkEditorSuggestionList form={form} />
    </>
  )
}
