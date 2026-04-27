import { Icons } from '@components/icons/registry'
import { normalizeHref, validateURL } from '@docs.plus/extension-hyperlink'
import { buildBookmarkHref, buildHeadingHref } from '@utils/link-helpers'
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from 'react'

import { useHyperlinkSuggestions } from '../hooks/useHyperlinkSuggestions'
import { useLinkSuggestionState } from '../hooks/useLinkSuggestionState'
import type { HyperlinkEditorProps, Suggestion } from '../types'
import { HyperlinkSuggestions } from './HyperlinkSuggestions'

const MOBILE_AUTOFOCUS_DELAY_MS = 50

// Shared width so Back (icon) and Apply (text) align in the right column.
const actionBtnClass = 'btn btn-ghost w-20 shrink-0'

export function HyperlinkEditor({
  mode,
  variant,
  editor,
  initialHref,
  initialText,
  validate,
  onApply,
  onBack,
  onClose,
  defaultSuggestionsState
}: HyperlinkEditorProps): ReactNode {
  const [href, setHref] = useState(initialHref)
  const [text, setText] = useState(initialText ?? '')
  const [textTouched, setTextTouched] = useState(false)
  const [showError, setShowError] = useState(false)

  const inputRef = useRef<HTMLInputElement | null>(null)
  const textInputId = useId()
  const rowIdPrefix = useId().replace(/:/g, '_')

  const {
    state: suggestionStateValue,
    expand,
    back,
    setQuery,
    setTotalRows,
    setHighlight,
    highlightNext,
    highlightPrev,
    highlightFirst,
    highlightLast
  } = useLinkSuggestionState({ defaultPanel: defaultSuggestionsState })

  // Skip the bookmark RPCs while the desktop popover is in `collapsed` —
  // bookmark section isn't visible and would otherwise prefetch two
  // queries on every popover open. Headings still update from the editor.
  const suggestionsHidden = suggestionStateValue.panel === 'collapsed'

  const { headings, bookmarks, isLoading } = useHyperlinkSuggestions({
    editor,
    query: href,
    disabled: suggestionsHidden
  })

  const totalRows = headings.length + bookmarks.length
  useEffect(() => {
    setTotalRows(totalRows)
  }, [totalRows, setTotalRows])

  const flat = useMemo<Suggestion[]>(() => [...headings, ...bookmarks], [headings, bookmarks])

  // Mobile: defer focus past the sheet animation so iOS Safari doesn't
  // drop focus on entry (mirrors the prior LinkEditorSheet behaviour).
  useEffect(() => {
    if (variant !== 'mobile') {
      inputRef.current?.focus()
      if (mode === 'edit' && initialHref) inputRef.current?.select()
      return
    }
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const rafId = requestAnimationFrame(() => {
      timeoutId = setTimeout(() => {
        inputRef.current?.focus()
        if (mode === 'edit' && initialHref) inputRef.current?.select()
      }, MOBILE_AUTOFOCUS_DELAY_MS)
    })
    return () => {
      cancelAnimationFrame(rafId)
      if (timeoutId !== undefined) clearTimeout(timeoutId)
    }
  }, [variant, mode, initialHref])

  const applyTyped = useCallback(() => {
    const raw = href.trim()
    if (!validateURL(raw, { customValidator: validate })) {
      setShowError(true)
      return
    }
    const normalized = normalizeHref(raw)
    let applied: boolean | void
    if (mode === 'edit') {
      const nextText = textTouched ? text : initialText
      applied = onApply({
        href: normalized,
        text: typeof nextText === 'string' && nextText.length > 0 ? nextText : undefined
      })
    } else {
      applied = onApply({ href: normalized })
    }
    if (applied === false) setShowError(true)
  }, [href, validate, mode, text, textTouched, initialText, onApply])

  const applyPicked = useCallback(
    (s: Suggestion) => {
      const pickedHref =
        s.kind === 'heading' ? buildHeadingHref(editor, s.id) : buildBookmarkHref(s)
      const pickedText = s.title
      let applied: boolean | void
      if (mode === 'edit') {
        // Edit mode: only update href by default. The picker is a target
        // chooser, not a text rewriter — replacing the rendered anchor
        // text with the heading/bookmark title is surprising. Only send
        // a `text` override when the user explicitly touched the Text
        // field (keeps the "rename + retarget in one go" path working).
        applied = onApply({ href: pickedHref, text: textTouched ? text : undefined })
        if (applied === false) setShowError(true)
        return
      }
      // Create mode: when the user already has text selected, the picker
      // links *that* text to the heading/bookmark — don't clobber it with
      // the picked title. Only insert the title when the selection is
      // empty (nothing to link otherwise).
      const hasSelection = !editor.state.selection.empty
      applied = onApply({ href: pickedHref, text: hasSelection ? undefined : pickedText })
      if (applied === false) setShowError(true)
    },
    [editor, mode, onApply, text, textTouched]
  )

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (suggestionStateValue.highlightIndex !== null) {
      const picked = flat[suggestionStateValue.highlightIndex]
      if (picked) {
        applyPicked(picked)
        return
      }
    }
    applyTyped()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      // First ArrowDown out of `collapsed` opens the panel without
      // also seeking — feels less abrupt than a same-keystroke jump.
      if (suggestionStateValue.panel === 'collapsed') {
        expand()
      } else {
        highlightNext()
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (suggestionStateValue.panel !== 'collapsed') highlightPrev()
    } else if (event.key === 'Home' && suggestionStateValue.panel !== 'collapsed') {
      event.preventDefault()
      highlightFirst()
    } else if (event.key === 'End' && suggestionStateValue.panel !== 'collapsed') {
      event.preventDefault()
      highlightLast()
    } else if (event.key === 'Enter' && suggestionStateValue.highlightIndex !== null) {
      event.preventDefault()
      const picked = flat[suggestionStateValue.highlightIndex]
      if (picked) applyPicked(picked)
    } else if (event.key === 'Escape') {
      // Escape ladder: clear highlight → dismiss panel → close popover.
      // Matches WAI-ARIA APG combobox guidance on the final stage.
      if (suggestionStateValue.highlightIndex !== null) {
        event.preventDefault()
        setHighlight(null)
      } else if (suggestionStateValue.panel === 'searching') {
        event.preventDefault()
        setHref('')
        setQuery('')
      } else if (suggestionStateValue.panel === 'browsing' && variant === 'desktop') {
        event.preventDefault()
        back()
      } else {
        onClose()
      }
    }
  }

  const isDesktop = variant === 'desktop'
  const isCreate = mode === 'create'

  // `aria-controls` and `aria-activedescendant` must only point at
  // mounted nodes; collapsed strips both to avoid dangling references.
  const listboxMounted = suggestionStateValue.panel !== 'collapsed'
  const listboxId = `${rowIdPrefix}-listbox`
  const activeRowId =
    listboxMounted && suggestionStateValue.highlightIndex !== null
      ? `${rowIdPrefix}-row-${suggestionStateValue.highlightIndex}`
      : undefined

  // daisyUI 5 input-with-icon: `<label class="input">` is the bordered,
  // focus-ringed wrapper; the bare <input> inside is unstyled. The leading
  // icon sits as a sibling and inherits the wrapper's focus state.
  const renderUrlField = (widthClass: string): ReactNode => (
    <label className={`input ${widthClass} ${showError ? 'input-error' : ''}`}>
      <Icons.link size={18} className="opacity-60" aria-hidden />
      <input
        ref={inputRef}
        type="url"
        inputMode="url"
        autoCapitalize="off"
        autoComplete="off"
        spellCheck={false}
        placeholder="Paste a link or pick a target"
        value={href}
        onChange={(event) => {
          setHref(event.target.value)
          setQuery(event.target.value)
          if (showError) setShowError(false)
        }}
        onKeyDown={handleKeyDown}
        data-testid="hyperlink-editor-url"
        // WAI-ARIA APG combobox: textbox owns the role; listbox is
        // referenced by aria-controls; aria-expanded reflects panel.
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={listboxMounted}
        aria-controls={listboxMounted ? listboxId : undefined}
        aria-activedescendant={activeRowId}
      />
    </label>
  )

  const errorMsg = showError ? (
    <span data-testid="hyperlink-editor-error" className="text-error text-xs font-medium">
      Please enter a valid URL
    </span>
  ) : null

  const suggestions = (
    <HyperlinkSuggestions
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

  // Both modes share the same row primitive: `[input] [ghost btn]`. Edit adds
  // a Text row above so users can retarget without renaming the anchor.
  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className={
        isDesktop
          ? 'hyperlink-link-popover-shell flex w-[22rem] flex-col gap-2 p-2'
          : 'bg-base-100 flex flex-col gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]'
      }>
      {!isCreate && (
        <div className="flex items-stretch gap-2">
          <label className="input flex-1">
            <Icons.textFormat size={18} className="opacity-60" aria-hidden />
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
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              data-testid="hyperlink-editor-back"
              className={actionBtnClass}>
              <Icons.back size={18} aria-hidden />
            </button>
          )}
        </div>
      )}

      <div className="flex items-stretch gap-2">
        {renderUrlField('flex-1')}
        <button
          type="submit"
          disabled={!href.trim()}
          data-testid="hyperlink-editor-submit"
          className={actionBtnClass}>
          Apply
        </button>
      </div>
      {errorMsg}

      {suggestions}
    </form>
  )
}
