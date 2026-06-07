import { Icons } from '@components/icons/registry'
import type { ReactNode } from 'react'

import type { HyperlinkEditorForm } from '../hooks/useHyperlinkEditorForm'
import { HyperlinkSuggestions } from './HyperlinkSuggestions'
import { HyperlinkUrlTextarea } from './HyperlinkUrlTextarea'

type FieldProps = { form: HyperlinkEditorForm }

export function HyperlinkEditorTextField({ form }: FieldProps): ReactNode {
  const { isCreate, text, textInputId, setText, setTextTouched } = form
  if (isCreate) return null

  return (
    <label className="input h-auto w-full min-w-0 items-start gap-2 py-1.5">
      <span className="mt-0.5 flex size-[18px] shrink-0 items-center justify-center opacity-60">
        <Icons.textFormat size={18} aria-hidden />
      </span>
      <input
        id={textInputId}
        type="text"
        placeholder="Link text"
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          setTextTouched(true)
        }}
        data-testid="hyperlink-editor-text"
      />
    </label>
  )
}

export function HyperlinkEditorUrlField({ form }: FieldProps): ReactNode {
  const {
    href,
    showError,
    inputRef,
    listboxMounted,
    listboxId,
    activeRowId,
    commitHref,
    handleKeyDown
  } = form

  return (
    <label
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
        combobox={{
          expanded: listboxMounted,
          controls: listboxMounted ? listboxId : undefined,
          activedescendant: activeRowId
        }}
      />
    </label>
  )
}

export function HyperlinkEditorError({ form }: FieldProps): ReactNode {
  if (!form.showError) return null
  return (
    <span data-testid="hyperlink-editor-error" className="text-error text-xs font-medium">
      Please enter a valid URL
    </span>
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
