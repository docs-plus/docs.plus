import { PanelSurfaceSkeleton } from '@components/PanelSurfaceSkeleton'
import { FieldSkeleton } from '@components/ui/FieldSkeleton'
import { TextLine } from '@components/ui/TextLine'
import { Icons } from '@icons'
import { useAuthStore, useStore } from '@stores'
import type { IconType } from 'react-icons'

import { DocumentAccessWell } from './DocumentAccessWell'
import { documentSettingsRows } from './documentSettingsRows'

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

  const rows = documentSettingsRows({ userId: user?.id, isAuthServiceAvailable, metadata })

  return (
    <PanelSurfaceSkeleton titleWidthClassName="w-36">
      <DocumentAccessWell rows={rows} />

      <div className="flex flex-col gap-4 p-4">
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
