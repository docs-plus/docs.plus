import { twMerge } from '@utils/twMerge'

import { TextLine } from './TextLine'

/** A field with its label above: a 20px label line, then the field (40px for an input). */
export const FieldSkeleton = ({
  labelWidth = 'w-16',
  fieldHeight = 'h-10',
  className
}: {
  labelWidth?: string
  fieldHeight?: string
  className?: string
}) => (
  <div className={twMerge('flex flex-col gap-1.5', className)}>
    <TextLine bone={`h-3 ${labelWidth}`} />
    <div className={`skeleton rounded-field w-full ${fieldHeight}`} />
  </div>
)
