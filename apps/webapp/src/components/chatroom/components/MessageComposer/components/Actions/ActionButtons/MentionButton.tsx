import { Icons } from '@icons'
import type { Editor } from '@tiptap/core'
import { useCallback, useSyncExternalStore } from 'react'
import { twMerge } from 'tailwind-merge'

import { dismissComposerOverlaysBeforeMention } from '../../../helpers/dismissComposerOverlays'
import {
  dismissComposerMentionSuggestion,
  getMentionPickerActive,
  getMentionPopupOpen,
  subscribeMentionPopup
} from '../../../helpers/mentionTypes'
import { useMessageComposer } from '../../../hooks/useMessageComposer'
import Button from '../../ui/Button'

/** @tiptap/suggestion only opens @ at block start or after whitespace. */
function needsSpaceBeforeMentionTrigger(editor: Editor): boolean {
  const { $from } = editor.state.selection

  if ($from.parentOffset === 0) return false

  const nodeBefore = $from.nodeBefore
  if (nodeBefore?.isText) {
    const lastChar = nodeBefore.text?.slice(-1) ?? ''
    return lastChar !== '' && !/\s/.test(lastChar)
  }

  if (nodeBefore) return true

  const charBefore = $from.parent.textBetween(
    $from.parentOffset - 1,
    $from.parentOffset,
    undefined,
    '\ufffc'
  )
  return charBefore !== '' && !/\s/.test(charBefore)
}

type Props = React.ComponentProps<typeof Button> & {
  size?: number
}

export const MentionButton = ({ className, size = 18, ...props }: Props) => {
  const { editor, isMobile } = useMessageComposer()
  const isActive = useSyncExternalStore(subscribeMentionPopup, getMentionPickerActive, () => false)

  const onPress = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault()
      if (!editor) return

      if (getMentionPickerActive()) {
        dismissComposerMentionSuggestion(editor)
        requestAnimationFrame(() => {
          if (!getMentionPopupOpen()) {
            editor.chain().focus().insertContent(' ').run()
          }
        })
        return
      }

      dismissComposerOverlaysBeforeMention()

      const trigger = needsSpaceBeforeMentionTrigger(editor) ? ' @' : '@'
      editor.chain().focus().insertContent(trigger).run()
    },
    [editor]
  )

  const ariaLabel = isActive ? 'Close mention picker' : 'Mention someone'

  return (
    <Button
      className={twMerge(
        isMobile
          ? 'size-11 min-h-11 min-w-11 shrink-0 rounded-lg border-0 p-0'
          : 'size-8 min-h-8 min-w-8 shrink-0 rounded-lg border-0 p-0',
        className
      )}
      onPress={onPress}
      tooltip={ariaLabel}
      tooltipPosition="top"
      isActive={isActive}
      aria-pressed={isActive}
      aria-label={ariaLabel}
      aria-expanded={isActive}
      {...props}>
      <Icons.mention
        size={size}
        className={twMerge(
          'pointer-events-none shrink-0 stroke-[1.75]',
          isActive && 'text-primary'
        )}
      />
    </Button>
  )
}
