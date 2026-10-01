import { useHistoryHash } from '@components/pages/history/historyShareUrl'
import { useOwnerDocuments } from '@components/settings/hooks/useOwnerDocuments'
import type { DocumentSortKey, OwnedDocument } from '@components/settings/types'
import { ContextMenuRow } from '@components/ui/ContextMenu'
import { Modal, ModalContent, ModalHeading } from '@components/ui/Dialog'
import { ListGroupLabel } from '@components/ui/ListGroupLabel'
import TextInput from '@components/ui/TextInput'
import { Icons } from '@icons'
import { useAuthStore, useSheetStore, useStore } from '@stores'
import { isModShortcut } from '@utils/platform'
import { twMerge } from '@utils/twMerge'
import debounce from 'lodash/debounce'
import { useRouter } from 'next/router'
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { IconType } from 'react-icons'
import { LuStar } from 'react-icons/lu'

import { buildPlaceRows, type CommandJumpSurface, type PlaceRow } from './buildPlaceRows'

// #247's Owner live list key: empty search under Last opened. Do not fork it.
const PAD_SORT: DocumentSortKey = 'lastOpenedAt_desc'
const SEARCH_DEBOUNCE_MS = 350

// Every house modal guard stamps the page behind it; sheets without a trap only show in the store.
function isAnotherLayerOpen(): boolean {
  if (useSheetStore.getState().activeSheet) return true
  return (
    document.querySelector(
      '[data-floating-ui-inert][aria-hidden="true"], [data-floating-ui-inert][inert], [aria-modal="true"]'
    ) !== null
  )
}

type JumpItem = { key: string; label: string; icon: IconType; favorite?: boolean; run: () => void }

const matches = (text: string, term: string) => text.toLowerCase().includes(term)

interface PanelProps {
  places: PlaceRow[]
  userId: string
  onPick: (run: () => void) => void
  navigate: (path: string) => void
}

function CommandJumpPanel({ places, userId, onPick, navigate }: PanelProps) {
  const baseId = useId()
  const listId = `${baseId}-list`
  const [query, setQuery] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [active, setActive] = useState(0)

  const debouncedSetSearch = useMemo(
    () => debounce((value: string) => setSearchTerm(value), SEARCH_DEBOUNCE_MS),
    []
  )
  useEffect(() => () => debouncedSetSearch.cancel(), [debouncedSetSearch])

  // With an empty term both calls share one key. While a typed search loads, the
  // live list filtered on the client fills in, so rows do not blink.
  const live = useOwnerDocuments({ userId, scope: 'owned', searchQuery: '', sortKey: PAD_SORT })
  const searched = useOwnerDocuments({
    userId,
    scope: 'owned',
    searchQuery: searchTerm,
    sortKey: PAD_SORT
  })

  const term = query.trim().toLowerCase()
  const placeItems: JumpItem[] = places
    .filter((place) => matches(place.label, term))
    .map((place) => ({
      key: `place:${place.id}`,
      label: place.label,
      icon: place.icon,
      run: place.run
    }))

  const pads: OwnedDocument[] = searched.data?.pages[0]?.docs ?? live.data?.pages[0]?.docs ?? []
  const padItems: JumpItem[] = pads
    .filter((doc) => matches(doc.title || doc.slug, term))
    .map((doc) => ({
      key: `pad:${doc.documentId}`,
      label: doc.title || doc.slug,
      icon: Icons.fileText,
      favorite: doc.isFavorite,
      run: () => navigate(`/${doc.slug}`)
    }))

  const items = [...placeItems, ...padItems]
  // The debounce window counts as loading, or a pad beyond the live page reads as missing.
  const docsQuery = searchTerm ? searched : live
  const isSearching = Boolean(userId) && (query.trim() !== searchTerm || docsQuery.isLoading)
  const searchFailed = Boolean(userId) && docsQuery.isError
  // One live region reads this line, so nothing speaks twice.
  const emptyStatus = isSearching
    ? 'Searching…'
    : searchFailed
      ? 'Could not load documents.'
      : 'No matches.'
  const activeIndex = items.length === 0 ? -1 : Math.min(active, items.length - 1)
  const optionId = useCallback((index: number) => `${baseId}-option-${index}`, [baseId])

  useEffect(() => {
    if (activeIndex < 0) return
    document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: 'nearest' })
  }, [optionId, activeIndex])

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (items.length === 0) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((activeIndex + step + items.length) % items.length)
      return
    }
    if (event.key === 'Enter' && !event.nativeEvent.isComposing && activeIndex >= 0) {
      event.preventDefault()
      onPick(items[activeIndex].run)
    }
  }

  const renderGroup = (label: string, group: JumpItem[], offset: number) => {
    if (group.length === 0) return null
    const headingId = `${baseId}-${label.toLowerCase()}`
    return (
      <div role="group" aria-labelledby={headingId} className="py-1">
        <ListGroupLabel as="div" id={headingId} className="px-3 pt-1 pb-1">
          {label}
        </ListGroupLabel>
        {group.map((item, i) => {
          const index = offset + i
          const Icon = item.icon
          const isActive = index === activeIndex
          return (
            // A div, not a button: the combobox keeps focus in the input and adds no tab stops.
            <div
              key={item.key}
              id={optionId(index)}
              role="option"
              aria-selected={isActive}
              // Keep focus in the input, so the phone keyboard and the combobox stay put.
              onMouseDown={(event) => event.preventDefault()}
              onMouseMove={() => !isActive && setActive(index)}
              onClick={() => onPick(item.run)}
              className="mx-1.5">
              <ContextMenuRow active={isActive} icon={<Icon size={16} aria-hidden />}>
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="truncate">{item.label}</span>
                  {item.favorite && (
                    <LuStar
                      size={13}
                      className="text-accent fill-accent shrink-0"
                      aria-label="Favorite"
                    />
                  )}
                </span>
              </ContextMenuRow>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <>
      <ModalHeading className="sr-only">Command jump</ModalHeading>
      <div className="border-base-300 shrink-0 border-b p-2">
        <TextInput
          ghost
          startIcon={Icons.search}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
            debouncedSetSearch(event.target.value.trim())
          }}
          onKeyDown={onKeyDown}
          placeholder="Jump to a place or a document"
          aria-label="Jump to"
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div id={listId} role="listbox" aria-label="Results" className="min-h-0 overflow-y-auto">
        {renderGroup('Places', placeItems, 0)}
        {renderGroup('Documents', padItems, placeItems.length)}
      </div>
      {items.length === 0 && (
        <p
          key={emptyStatus}
          aria-hidden
          className={twMerge(
            'text-base-content/60 px-3 py-6 text-center text-sm',
            // The 300ms hold keeps a fast search from flashing the loading line.
            isSearching && 'animate-[doc-content-in_120ms_ease-out_300ms_backwards]'
          )}>
          {emptyStatus}
        </p>
      )}
      <p className="sr-only" aria-live="polite">
        {items.length === 0
          ? emptyStatus
          : items.length === 1
            ? '1 result'
            : `${items.length} results`}
      </p>
    </>
  )
}

// Runs a pick once the dialog has unmounted and the focus manager has handed focus back,
// so Find, Filter, and Settings keep the focus they take.
function RunPickOnUnmount({ pickRef }: { pickRef: React.RefObject<(() => void) | null> }) {
  useEffect(
    () => () => {
      const run = pickRef.current
      pickRef.current = null
      if (run) window.setTimeout(run, 0)
    },
    [pickRef]
  )
  return null
}

/**
 * Command jump (#254): Mod+Shift+K opens a named go-to list of places and owned pads.
 * Firefox on Windows and Linux uses Ctrl+Shift+K for the Web Console. A page may take it,
 * so this shadows that key while the page is open; F12 still opens DevTools.
 */
export function CommandJump({ surface }: { surface: CommandJumpSurface }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [places, setPlaces] = useState<PlaceRow[]>([])
  const pickRef = useRef<(() => void) | null>(null)

  const user = useAuthStore((state) => state.profile)
  const isAuthServiceAvailable = useStore((state) => state.settings.isAuthServiceAvailable)
  const editor = useStore((state) => state.settings.editor.instance)
  const isMobile = useStore((state) => state.settings.editor.isMobile) ?? false
  const { isHistory } = useHistoryHash()
  const signedIn = Boolean(user && isAuthServiceAvailable)

  // Never `_blank`: one pad window per person (#261).
  const navigate = useCallback((path: string) => void router.push(path), [router])

  const openJump = useCallback(() => {
    setPlaces(
      buildPlaceRows({
        surface,
        signedIn,
        isHistory,
        isMobile,
        editor: editor ?? null,
        navigate
      })
    )
    setOpen(true)
  }, [surface, signedIn, isHistory, isMobile, editor, navigate])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isModShortcut(event, 'k', { shift: true })) return
      if (open) {
        event.preventDefault()
        setOpen(false)
        return
      }
      if (isAnotherLayerOpen()) return
      event.preventDefault()
      if (!event.repeat) openJump()
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open, openJump])

  const onPick = useCallback((run: () => void) => {
    pickRef.current = run
    setOpen(false)
  }, [])

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalContent
        size="lg"
        align="top"
        className="max-h-[min(32rem,80vh)] sm:mt-[12vh]"
        data-testid="command-jump">
        <CommandJumpPanel
          places={places}
          userId={signedIn && user ? user.id : ''}
          onPick={onPick}
          navigate={navigate}
        />
        <RunPickOnUnmount pickRef={pickRef} />
      </ModalContent>
    </Modal>
  )
}

export default CommandJump
