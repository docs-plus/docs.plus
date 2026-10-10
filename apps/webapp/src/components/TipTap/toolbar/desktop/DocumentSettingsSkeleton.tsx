import { PanelSurfaceSkeleton } from '@components/PanelSurfaceSkeleton'
import { FieldSkeleton, TextLine } from '@components/settings/SettingsPanelSkeleton'
import { ToggleRowSkeleton } from '@components/settings/ToggleRowSkeleton'
import { Icons } from '@icons'
import { useAuthStore, useStore } from '@stores'
import type { IconType } from 'react-icons'

const TOGGLE_ROW_CLASS = 'min-h-11 py-2 sm:min-h-0'

// The real `collapse` classes keep the title padding and the arrow; the bone sits in a 24px line.
const AccordionTitleSkeleton = ({ icon: Icon, width }: { icon: IconType; width: string }) => (
  <div className="collapse-title flex items-center gap-2">
    <Icon size={16} aria-hidden className="text-base-content/50 shrink-0" />
    <TextLine box="h-6" bone={`h-4 ${width}`} />
  </div>
)

export const DocumentSettingsSkeleton = () => {
  const user = useAuthStore((state) => state.profile)
  const isAuthServiceAvailable = useStore((state) => state.settings.isAuthServiceAvailable)
  const metadata = useStore((state) => state.settings.metadata)

  // The soft well rows follow the same store fields as `DocumentSettingsPanel`.
  const isPrivate = Boolean(metadata.isPrivate)
  const readOnly = Boolean(metadata.readOnly)
  const isOwner = Boolean(user?.id && user.id === metadata.ownerId)
  const hasIdentity = Boolean(isAuthServiceAvailable && metadata.ownerProfile)
  const showFollow =
    Boolean(isAuthServiceAvailable && user?.id) && (!isOwner || (!isPrivate && !readOnly))

  return (
    <PanelSurfaceSkeleton titleWidthClassName="w-36">
      <div className="bg-base-200 border-base-300 flex flex-col border-b">
        {hasIdentity ? (
          <>
            <div className="flex items-center gap-3 px-4 py-3" aria-hidden>
              <div className="skeleton size-8 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <TextLine bone="h-3 w-14" />
                <TextLine bone="h-3.5 w-28" />
              </div>
            </div>
            <div className="border-base-300 border-t" />
          </>
        ) : null}
        <div className="flex flex-col px-4 py-2">
          {isOwner && isAuthServiceAvailable ? (
            <>
              <ToggleRowSkeleton
                label="Private"
                description="Only you can open this document."
                className={TOGGLE_ROW_CLASS}
              />
              <ToggleRowSkeleton
                label="Read-only"
                description={
                  isPrivate
                    ? 'Not used while the document is private.'
                    : 'Viewers can’t edit this document.'
                }
                className={TOGGLE_ROW_CLASS}
              />
            </>
          ) : (
            <div className="flex flex-wrap gap-2 py-2">
              <span className="badge badge-sm badge-soft">{isPrivate ? 'Private' : 'Public'}</span>
              <span className="badge badge-sm badge-soft">
                {readOnly ? 'Read-only' : 'Editable'}
              </span>
            </div>
          )}
          {showFollow ? (
            <ToggleRowSkeleton
              label="Follow"
              description="Notify me when this document changes."
              className={TOGGLE_ROW_CLASS}
            />
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4" aria-hidden>
        {/* Document preferences opens by default, so its body is drawn too. */}
        <div className="collapse-arrow collapse-open rounded-box border-base-300 bg-base-100 collapse border">
          <AccordionTitleSkeleton icon={Icons.fileText} width="w-40" />
          <div className="collapse-content border-base-300 border-t px-4 pt-4">
            <div className="flex flex-col gap-4">
              {/* 3 rows of 21px, 16px padding and a 1px border: 81px, read from CSS. */}
              <FieldSkeleton labelWidth="w-20" fieldHeight="h-20.25" />
              <FieldSkeleton labelWidth="w-20" />
              <div className="flex justify-end pt-2">
                <div className="skeleton rounded-field h-8 w-28" />
              </div>
            </div>
          </div>
        </div>
        <div className="collapse-arrow rounded-box border-base-300 bg-base-100 collapse border">
          <AccordionTitleSkeleton icon={Icons.download} width="w-28" />
        </div>
      </div>
    </PanelSurfaceSkeleton>
  )
}

export default DocumentSettingsSkeleton
