import type { Editor } from '@tiptap/core'
import { useEffect, useRef } from 'react'
import { twMerge } from 'tailwind-merge'

import {
  pickSlashIndex,
  selectSlashIndex,
  SLASH_LISTBOX_ID,
  slashOptionId,
  useSlashSession
} from './slashMenuSession'

/** One listbox for the desktop caret popover and the phone sheet. Focus stays in the editor. */
export default function SlashMenuList({
  editor,
  className
}: {
  editor: Editor
  className?: string
}) {
  const session = useSlashSession()
  const listRef = useRef<HTMLDivElement>(null)
  const activeId = session?.items.length ? slashOptionId(session.selectedIndex) : undefined

  // Written on the element directly: editorProps.attributes would drop Tiptap's role="textbox".
  useEffect(() => {
    if (editor.isDestroyed) return
    const dom = editor.view.dom
    if (activeId) dom.setAttribute('aria-activedescendant', activeId)
    else dom.removeAttribute('aria-activedescendant')
  }, [editor, activeId])

  useEffect(() => {
    if (!activeId) return
    listRef.current?.querySelector(`#${activeId}`)?.scrollIntoView({ block: 'nearest' })
  }, [activeId])

  if (!session) return null

  return (
    <div
      ref={listRef}
      id={SLASH_LISTBOX_ID}
      role="listbox"
      aria-label="Insert block"
      data-testid="slash-menu"
      className={twMerge('p-1', className)}>
      {session.items.length === 0 ? (
        <div className="text-base-content/60 px-2 py-3 text-sm">No matching blocks</div>
      ) : (
        session.items.map((item, index) => {
          const Icon = item.icon
          const selected = index === session.selectedIndex
          return (
            <div
              key={item.id}
              id={slashOptionId(index)}
              role="option"
              aria-selected={selected}
              tabIndex={-1}
              data-testid="slash-menu-option"
              data-slash-item={item.id}
              onMouseEnter={() => selectSlashIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pickSlashIndex(index)}
              className={twMerge(
                'hover:bg-base-200 rounded-field flex min-h-11 w-full cursor-pointer items-center gap-2.5 px-2.5 py-1.5 text-left text-sm',
                selected && 'bg-base-200'
              )}>
              <Icon size={16} className="shrink-0 opacity-70" aria-hidden />
              <span className="truncate font-medium">{item.label}</span>
            </div>
          )
        })
      )}
    </div>
  )
}
