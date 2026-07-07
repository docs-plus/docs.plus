import {
  CHAT_MEDIA_MAX_ATTACHMENTS,
  CHAT_MEDIA_MAX_BYTES
} from '@components/chatroom/utils/messageMediaPaths'
import { Icons } from '@icons'
import { twMerge } from 'tailwind-merge'

import { useComposerAttachInput } from '../../../hooks/useComposerAttachInput'
import { useMessageComposer } from '../../../hooks/useMessageComposer'
import Button from '../../ui/Button'

type Props = React.ComponentProps<typeof Button> & {
  size?: number
}

export const AttachButton = ({ className, size = 18, ...props }: Props) => {
  const { isMobile } = useMessageComposer()
  const { inputRef, onInputChange, openFilePicker, atLimit, accept } = useComposerAttachInput()

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        {...(accept ? { accept } : {})}
        multiple
        className="sr-only"
        tabIndex={-1}
        data-testid="composer-attach-input"
        aria-label={`Attach files up to ${Math.round(CHAT_MEDIA_MAX_BYTES / (1024 * 1024))} MB each`}
        onChange={onInputChange}
      />
      <Button
        className={twMerge(
          isMobile
            ? 'rounded-field size-11 min-h-11 min-w-11 shrink-0 border-0 p-0'
            : 'rounded-field size-8 min-h-8 min-w-8 shrink-0 border-0 p-0',
          atLimit && 'opacity-40',
          className
        )}
        onPress={openFilePicker}
        tooltip={
          atLimit ? `Attachment limit reached (${CHAT_MEDIA_MAX_ATTACHMENTS})` : 'Attach file'
        }
        tooltipPosition="top"
        aria-label="Attach file"
        aria-disabled={atLimit}
        {...props}>
        <Icons.upload size={size} className="pointer-events-none shrink-0 stroke-[1.75]" />
      </Button>
    </>
  )
}
