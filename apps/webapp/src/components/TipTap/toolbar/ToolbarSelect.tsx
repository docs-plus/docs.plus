import { ContextMenuRow, MenuItem, useContextMenuContext } from '@components/ui/ContextMenu'
import { DropdownMenu } from '@components/ui/DropdownMenu'
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
  /** Also the trigger's accessible name, which names the menu too. */
  tooltip: string
  fallbackIcon: IconType
  /** Specs select the trigger by this, never by its user-facing label. */
  testId: string
}

const ToolbarSelectItems = ({ items, editor }: { items: ToolbarSelectItem[]; editor: Editor }) => {
  const { setIsOpen } = useContextMenuContext()

  return items.map((item) => {
    const active = editor.isActive(item.value)
    return (
      <MenuItem
        key={item.value}
        role="menuitemradio"
        aria-checked={active}
        data-testid={item.testId}
        onClick={() => {
          item.action()
          setIsOpen(false)
        }}>
        <ContextMenuRow
          icon={<item.icon size={16} className="stroke-currentColor fill-none" />}
          trailing={active && <Icons.check size={16} className="text-primary" aria-hidden />}>
          {item.label}
        </ContextMenuRow>
      </MenuItem>
    )
  })
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
    <DropdownMenu
      placement="bottom-start"
      trigger={({ ref, getProps }) => (
        <ToolbarButton
          ref={ref}
          {...getProps()}
          isActive={!!activeItem}
          tooltip={tooltip}
          data-testid={testId}
          shape={null}
          className="gap-0.5 px-1.5">
          <TriggerIcon size={16} className="stroke-currentColor fill-none" />
          <Icons.chevronDown size={10} className="stroke-currentColor fill-none opacity-40" />
        </ToolbarButton>
      )}>
      <ToolbarSelectItems items={items} editor={editor} />
    </DropdownMenu>
  )
}

export default ToolbarSelect
