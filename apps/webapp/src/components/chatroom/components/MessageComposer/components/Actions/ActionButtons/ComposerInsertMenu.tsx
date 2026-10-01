import { ContextMenuRowButton } from '@components/ui/ContextMenuRowButton'
import {
  Popover,
  PopoverContent,
  popoverPanelClassName,
  PopoverTrigger,
  usePopoverState
} from '@components/ui/Popover'
import { Icons } from '@icons'
import { twMerge } from '@utils/twMerge'

import { useComposerAttachInput } from '../../../hooks/useComposerAttachInput'
import { useMessageComposer } from '../../../hooks/useMessageComposer'
import Button from '../../ui/Button'

type Props = {
  showVoiceEntry?: boolean
  onVoiceFromMenu?: () => void
  className?: string
}

type InsertMenuRowsProps = {
  atLimit: boolean
  isMobile: boolean
  showFormattingToolbar: boolean
  showVoiceEntry?: boolean
  onAttach: () => void
  onFormat: () => void
  onVoice: () => void
}

// The panel is a dialog of plain buttons (chatroom CLAUDE.md), so rows are `ContextMenuRowButton`,
// not `MenuItem`.
function InsertMenuRows({
  atLimit,
  isMobile,
  showFormattingToolbar,
  showVoiceEntry,
  onAttach,
  onFormat,
  onVoice
}: InsertMenuRowsProps) {
  const { close } = usePopoverState()
  const rowClassName = isMobile ? 'min-h-11 gap-3 px-3 py-2.5' : undefined
  const run = (action: () => void) => () => {
    action()
    close()
  }

  return (
    <>
      <ContextMenuRowButton
        icon={<Icons.upload size={18} className="stroke-[1.75]" />}
        rowClassName={rowClassName}
        disabled={atLimit}
        onClick={run(onAttach)}>
        Attach file
      </ContextMenuRowButton>
      <ContextMenuRowButton
        icon={<Icons.textFormat size={18} className="stroke-[1.75]" />}
        rowClassName={rowClassName}
        variant={showFormattingToolbar ? 'primary' : 'default'}
        onClick={run(onFormat)}>
        {showFormattingToolbar ? 'Hide formatting' : 'Text formatting'}
      </ContextMenuRowButton>
      {showVoiceEntry ? (
        <ContextMenuRowButton
          icon={<Icons.mic size={18} className="stroke-[1.75]" />}
          rowClassName={rowClassName}
          onClick={run(onVoice)}>
          Record voice
        </ContextMenuRowButton>
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

/** Left-edge + menu: attach, text formatting, optional voice — opens on click/tap only. */
export function ComposerInsertMenu({ showVoiceEntry, onVoiceFromMenu, className }: Props) {
  const { isMobile, showFormattingToolbar, toggleToolbar } = useMessageComposer()
  const attach = useComposerAttachInput()

  return (
    <>
      <ComposerAttachInput {...attach} />
      <Popover placement="top-start">
        <PopoverTrigger asChild>
          <Button
            className={className}
            data-testid="composer-insert-trigger"
            aria-label="Insert — attach, format, and more">
            <Icons.plus
              size={isMobile ? 20 : 18}
              className="pointer-events-none shrink-0 stroke-[1.75]"
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={twMerge(popoverPanelClassName, isMobile ? 'w-52 p-1.5' : 'w-48 p-1')}
          aria-label="Insert">
          <InsertMenuRows
            atLimit={attach.atLimit}
            isMobile={isMobile}
            showFormattingToolbar={showFormattingToolbar}
            showVoiceEntry={showVoiceEntry}
            onAttach={attach.openFilePicker}
            onFormat={toggleToolbar}
            onVoice={() => onVoiceFromMenu?.()}
          />
        </PopoverContent>
      </Popover>
    </>
  )
}
