import { normalizeHref, validateURL } from '@docs.plus/extension-hyperlink'
import { buildBookmarkHref, buildHeadingHref } from '@utils/link-helpers'
import {
  type FormEvent,
  type KeyboardEvent,
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

const MOBILE_AUTOFOCUS_DELAY_MS = 50

export function useHyperlinkEditorForm({
  mode,
  variant,
  editor,
  initialHref,
  initialText,
  validate,
  onApply,
  onClose,
  defaultSuggestionsState
}: HyperlinkEditorProps) {
  const [href, setHref] = useState(initialHref)
  const [text, setText] = useState(initialText ?? '')
  const [textTouched, setTextTouched] = useState(false)
  const [showError, setShowError] = useState(false)

  const inputRef = useRef<HTMLTextAreaElement>(null)
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

  const commitHref = useCallback(
    (value: string) => {
      setHref(value)
      setQuery(value)
      if (showError) setShowError(false)
    },
    [setQuery, showError]
  )

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
        applied = onApply({ href: pickedHref, text: textTouched ? text : undefined })
        if (applied === false) setShowError(true)
        return
      }
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

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
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
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (href.trim() || suggestionStateValue.highlightIndex !== null) {
        event.currentTarget.form?.requestSubmit()
      }
    } else if (event.key === 'Escape') {
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
  const sheetTitle = isCreate ? 'Add link' : 'Edit link'

  const listboxMounted = suggestionStateValue.panel !== 'collapsed'
  const listboxId = `${rowIdPrefix}-listbox`
  const activeRowId =
    listboxMounted && suggestionStateValue.highlightIndex !== null
      ? `${rowIdPrefix}-row-${suggestionStateValue.highlightIndex}`
      : undefined

  return {
    isDesktop,
    isCreate,
    sheetTitle,
    href,
    text,
    showError,
    inputRef,
    textInputId,
    rowIdPrefix,
    suggestionStateValue,
    headings,
    bookmarks,
    isLoading,
    listboxMounted,
    listboxId,
    activeRowId,
    commitHref,
    applyPicked,
    handleSubmit,
    handleKeyDown,
    setText,
    setTextTouched,
    expand,
    back,
    setHighlight,
    variant
  }
}

export type HyperlinkEditorForm = ReturnType<typeof useHyperlinkEditorForm>
