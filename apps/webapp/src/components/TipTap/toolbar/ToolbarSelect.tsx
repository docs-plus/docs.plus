import { Popover, PopoverContent, PopoverTrigger, usePopoverState } from '@components/ui/Popover'
import { Icons } from '@icons'
import type { Editor } from '@tiptap/core'
import type { IconType } from 'react-icons'
import { twMerge } from 'tailwind-merge'

import ToolbarButton from './ToolbarButton'

export interface ToolbarSelectItem {
  value: string
  label: string
  icon: IconType
  action: () => void
  /** Kebab-case, like every other toolbar id. `value` is a Tiptap node name. */
  testId: string
}

interface ToolbarSelectProps {
  editor: Editor
  items: ToolbarSelectItem[]
  tooltip?: string
  /** Trigger's accessible name — reuse the same string passed to `tooltip`. */
  'aria-label'?: string
  fallbackIcon: IconType
  /** Specs select the trigger by this, never by its user-facing label. */
  testId: string
}

const ToolbarSelectPanel = ({ items, editor }: { items: ToolbarSelectItem[]; editor: Editor }) => {
  const { close } = usePopoverState()

  return (
    <div
      className="bg-base-100 border-base-300 rounded-box flex flex-col border py-1 shadow-xl"
      role="menu">
      {items.map((item) => {
        const active = editor.isActive(item.value)
        return (
          <button
            key={item.value}
            type="button"
            role="menuitemradio"
            aria-checked={active}
            data-testid={item.testId}
            className={twMerge(
              'hover:bg-base-200 flex items-center gap-2 px-3 py-1.5 text-sm transition-colors',
              active && 'text-primary'
            )}
            onClick={() => {
              item.action()
              close()
            }}>
            <item.icon size={16} className="stroke-currentColor fill-none" />
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

const ToolbarSelect = ({
  editor,
  items,
  tooltip,
  'aria-label': ariaLabel,
  fallbackIcon: FallbackIcon,
  testId
}: ToolbarSelectProps) => {
  const activeItem = items.find((item) => editor.isActive(item.value))
  const TriggerIcon = activeItem?.icon ?? FallbackIcon

  return (
    <Popover placement="bottom-start">
      <PopoverTrigger asChild>
        <div>
          <ToolbarButton
            isActive={!!activeItem}
            tooltip={tooltip}
            aria-label={ariaLabel}
            data-testid={testId}
            shape={null}
            className="gap-0.5 px-1.5">
            <TriggerIcon size={16} className="stroke-currentColor fill-none" />
            <Icons.chevronDown size={10} className="stroke-currentColor fill-none opacity-40" />
          </ToolbarButton>
        </div>
      </PopoverTrigger>
      <PopoverContent>
        <ToolbarSelectPanel items={items} editor={editor} />
      </PopoverContent>
    </Popover>
  )
}

export default ToolbarSelect
