import {
  Popover,
  PopoverClose,
  PopoverContent,
  popoverPanelClassName,
  PopoverTrigger
} from '@components/ui/Popover'
import { Icons } from '@icons'
import { useCallback, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

import { useComposerAttachInput } from '../../../hooks/useComposerAttachInput'
import { useMessageComposer } from '../../../hooks/useMessageComposer'
import Button from '../../ui/Button'

type Props = {
  showVoiceEntry?: boolean
  onVoiceFromMenu?: () => void
  className?: string
}

type MenuRowsProps = {
  atLimit: boolean
  showFormattingToolbar: boolean
  showVoiceEntry?: boolean
  onAttach: () => void
  onFormat: () => void
  onVoice: () => void
  rowClassName: string
}

function InsertMenuRows({
  atLimit,
  showFormattingToolbar,
  showVoiceEntry,
  onAttach,
  onFormat,
  onVoice,
  rowClassName
}: MenuRowsProps) {
  const formatLabel = showFormattingToolbar ? 'Hide formatting' : 'Text formatting'

  return (
    <>
      <PopoverClose
        type="button"
        role="menuitem"
        className={rowClassName}
        disabled={atLimit}
        onClick={onAttach}>
        <Icons.upload size={18} className="text-base-content/80 shrink-0 stroke-[1.75]" />
        Attach file
      </PopoverClose>
      <PopoverClose
        type="button"
        role="menuitem"
        className={twMerge(rowClassName, showFormattingToolbar && 'text-primary')}
        aria-pressed={showFormattingToolbar}
        onClick={onFormat}>
        <Icons.textFormat
          size={18}
          className={twMerge(
            'shrink-0 stroke-[1.75]',
            showFormattingToolbar ? 'text-primary' : 'text-base-content/80'
          )}
        />
        {formatLabel}
      </PopoverClose>
      {showVoiceEntry ? (
        <PopoverClose type="button" role="menuitem" className={rowClassName} onClick={onVoice}>
          <Icons.mic size={18} className="text-base-content/80 shrink-0 stroke-[1.75]" />
          Record voice
        </PopoverClose>
      ) : null}
    </>
  )
}

function ComposerAttachInput({
  inputRef,
  accept,
  onInputChange
}: Pick<ReturnType<typeof useComposerAttachInput>, 'inputRef' | 'accept' | 'onInputChange'>) {
  return (
    <input
      ref={inputRef}
      type="file"
      {...(accept ? { accept } : {})}
      multiple
      className="sr-only"
      tabIndex={-1}
      data-testid="composer-attach-input"
      aria-hidden
      onChange={onInputChange}
    />
  )
}

function ComposerInsertMenuMobile({ showVoiceEntry, onVoiceFromMenu, className }: Props) {
  const { showFormattingToolbar, toggleToolbar } = useMessageComposer()
  const attach = useComposerAttachInput()

  const onFormat = useCallback(() => {
    toggleToolbar()
  }, [toggleToolbar])

  const rowClassName =
    'hover:bg-base-200 flex w-full min-h-11 items-center gap-3 rounded-field px-3 py-2.5 text-left text-sm disabled:opacity-40'

  return (
    <>
      <ComposerAttachInput {...attach} />
      <Popover placement="top-start">
        <PopoverTrigger asChild>
          <Button
            className={twMerge(
              'rounded-field size-11 min-h-11 min-w-11 shrink-0 border-0 p-0',
              className
            )}
            data-testid="composer-insert-trigger"
            aria-label="Insert — attach, format, and more"
            aria-haspopup="menu"
            tooltip="Insert"
            tooltipPosition="top">
            <Icons.plus size={20} className="pointer-events-none shrink-0 stroke-[1.75]" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className={twMerge(popoverPanelClassName, 'w-52 p-1.5')} role="menu">
          <InsertMenuRows
            atLimit={attach.atLimit}
            showFormattingToolbar={showFormattingToolbar}
            showVoiceEntry={showVoiceEntry}
            onAttach={attach.openFilePicker}
            onFormat={onFormat}
            onVoice={() => onVoiceFromMenu?.()}
            rowClassName={rowClassName}
          />
        </PopoverContent>
      </Popover>
    </>
  )
}

function ComposerInsertMenuDesktop({ showVoiceEntry, onVoiceFromMenu, className }: Props) {
  const { showFormattingToolbar, toggleToolbar } = useMessageComposer()
  const attach = useComposerAttachInput()
  const closeTimerRef = useRef<number | null>(null)
  const [open, setOpen] = useState(false)

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const openMenu = useCallback(() => {
    clearCloseTimer()
    setOpen(true)
  }, [clearCloseTimer])

  const scheduleCloseMenu = useCallback(() => {
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 100)
  }, [clearCloseTimer])

  const onFormat = useCallback(() => {
    toggleToolbar()
  }, [toggleToolbar])

  const rowClassName =
    'hover:bg-base-200 flex w-full items-center gap-2.5 rounded-field px-2.5 py-2 text-left text-sm disabled:opacity-40'

  return (
    <>
      <ComposerAttachInput {...attach} />
      <Popover open={open} onOpenChange={setOpen} placement="top-start">
        <PopoverTrigger asChild>
          <Button
            className={twMerge(
              'rounded-field size-8 min-h-8 min-w-8 shrink-0 border-0 p-0',
              className
            )}
            data-testid="composer-insert-trigger"
            aria-label="Insert — attach, format, and more"
            aria-haspopup="menu"
            tooltip="Insert"
            tooltipPosition="top"
            onMouseEnter={openMenu}
            onMouseLeave={scheduleCloseMenu}
            onPress={() => setOpen((value) => !value)}>
            <Icons.plus size={18} className="pointer-events-none shrink-0 stroke-[1.75]" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={twMerge(popoverPanelClassName, 'w-48 p-1')}
          role="menu"
          onMouseEnter={openMenu}
          onMouseLeave={scheduleCloseMenu}>
          <InsertMenuRows
            atLimit={attach.atLimit}
            showFormattingToolbar={showFormattingToolbar}
            showVoiceEntry={showVoiceEntry}
            onAttach={attach.openFilePicker}
            onFormat={onFormat}
            onVoice={() => onVoiceFromMenu?.()}
            rowClassName={rowClassName}
          />
        </PopoverContent>
      </Popover>
    </>
  )
}

/** Left-edge + menu: attach, text formatting, optional voice (Telegram / Discord pattern). */
export function ComposerInsertMenu(props: Props) {
  const { isMobile } = useMessageComposer()
  if (isMobile) return <ComposerInsertMenuMobile {...props} />
  return <ComposerInsertMenuDesktop {...props} />
}
