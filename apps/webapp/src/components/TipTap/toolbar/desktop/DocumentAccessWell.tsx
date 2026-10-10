import { Avatar } from '@components/ui/Avatar'
import { ToggleRow } from '@components/ui/ToggleRow'
import { ToggleRowSkeleton } from '@components/ui/ToggleRowSkeleton'
import type { useDocumentAccessMutation } from '@hooks/useDocumentAccessMutation'

import type { DocumentSettingsRows } from './documentSettingsRows'

type SwitchState = { checked: boolean; disabled: boolean; onChange: () => void }

const ROW_CLASS = 'min-h-11 py-2 sm:min-h-0'

function SwitchRow({
  label,
  description,
  state
}: {
  label: string
  description: string
  state?: SwitchState
}) {
  if (!state)
    return <ToggleRowSkeleton label={label} description={description} className={ROW_CLASS} />
  return (
    <ToggleRow
      label={label}
      description={description}
      checked={state.checked}
      disabled={state.disabled}
      onChange={state.onChange}
      className={ROW_CLASS}
    />
  )
}

interface DocumentAccessWellProps {
  rows: DocumentSettingsRows
  /** Absent while the panel chunk loads, so the access switches draw as bones. */
  access?: Pick<
    ReturnType<typeof useDocumentAccessMutation>,
    'setPrivate' | 'setReadOnly' | 'isControlDisabled'
  >
  /** Absent while the chunk loads or the follow read is in flight. */
  follow?: SwitchState
}

/** The soft well of Document settings. The panel and its chunk loader both draw this one. */
export function DocumentAccessWell({ rows, access, follow }: DocumentAccessWellProps) {
  const { identity, isPrivate, readOnly } = rows

  return (
    <div className="bg-base-200 border-base-300 flex flex-col border-b">
      {identity ? (
        <>
          <div className="flex items-center gap-3 px-4 py-3">
            <Avatar
              face={{ ...identity, avatar_url: identity.avatar_url || identity.default_avatar_url }}
              alt={identity.full_name ?? undefined}
              clickable={false}
              size="sm"
              className="shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-base-content/70 text-meta font-semibold">Owned by</p>
              <p className="text-base-content truncate text-sm font-medium">{identity.full_name}</p>
            </div>
          </div>
          <div className="border-base-300 border-t" />
        </>
      ) : null}
      <div className="flex flex-col px-4 py-2">
        {rows.canManageAccess ? (
          <>
            <SwitchRow
              label="Private"
              description="Only you can open this document."
              state={
                access && {
                  checked: isPrivate,
                  disabled: access.isControlDisabled('isPrivate'),
                  onChange: () => access.setPrivate(!isPrivate)
                }
              }
            />
            <SwitchRow
              label="Read-only"
              description={
                isPrivate
                  ? 'Not used while the document is private.'
                  : 'Viewers can’t edit this document.'
              }
              state={
                access && {
                  checked: readOnly,
                  disabled: access.isControlDisabled('readOnly'),
                  onChange: () => access.setReadOnly(!readOnly)
                }
              }
            />
          </>
        ) : (
          <div className="flex flex-wrap gap-2 py-2">
            <span className="badge badge-sm badge-soft">{isPrivate ? 'Private' : 'Public'}</span>
            <span className="badge badge-sm badge-soft">{readOnly ? 'Read-only' : 'Editable'}</span>
          </div>
        )}
        {rows.showFollow ? (
          <SwitchRow
            label="Follow"
            description="Notify me when this document changes."
            state={follow}
          />
        ) : null}
      </div>
    </div>
  )
}
