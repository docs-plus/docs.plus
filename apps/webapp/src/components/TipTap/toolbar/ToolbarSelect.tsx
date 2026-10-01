import { contextMenuPanelClassName } from '@components/ui/ContextMenu'
import { ContextMenuRowButton } from '@components/ui/ContextMenuRowButton'
import { Popover, PopoverContent, PopoverTrigger, usePopoverState } from '@components/ui/Popover'
import { Icons } from '@icons'
import type { Editor } from '@tiptap/core'
import type { IconType } from 'react-icons'

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
  fallbackIcon: IconType
  /** Specs select the trigger by this, never by its user-facing label. */
  testId: string
}

const ToolbarSelectPanel = ({ items, editor }: { items: ToolbarSelectItem[]; editor: Editor }) => {
  const { close } = usePopoverState()

  // The popover moves real focus onto the rows, so each row button carries MenuItem's focus recipe.
  return (
    <div className={contextMenuPanelClassName} role="menu">
      {items.map((item) => {
        const active = editor.isActive(item.value)
        return (
          <ContextMenuRowButton
            key={item.value}
            role="menuitemradio"
            aria-checked={active}
            data-testid={item.testId}
            icon={<item.icon size={16} className="stroke-currentColor fill-none" />}
            trailing={active && <Icons.check size={16} className="text-primary" aria-hidden />}
            onClick={() => {
              item.action()
              close()
            }}>
            {item.label}
          </ContextMenuRowButton>
        )
      })}
    </div>
  )
}

const ToolbarSelect = ({
  editor,
  items,
  tooltip,
  fallbackIcon: FallbackIcon,
  testId
}: ToolbarSelectProps) => {
  const activeItem = items.find((item) => editor.isActive(item.value))
  const TriggerIcon = activeItem?.icon ?? FallbackIcon

  return (
    <Popover placement="bottom-start">
      <PopoverTrigger asChild>
        <ToolbarButton
          isActive={!!activeItem}
          tooltip={tooltip}
          data-testid={testId}
          shape={null}
          className="gap-0.5 px-1.5">
          <TriggerIcon size={16} className="stroke-currentColor fill-none" />
          <Icons.chevronDown size={10} className="stroke-currentColor fill-none opacity-40" />
        </ToolbarButton>
      </PopoverTrigger>
      <PopoverContent>
        <ToolbarSelectPanel items={items} editor={editor} />
      </PopoverContent>
    </Popover>
  )
}

export default ToolbarSelect
