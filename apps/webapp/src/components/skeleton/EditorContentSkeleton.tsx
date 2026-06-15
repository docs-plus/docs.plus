import DocumentSimpleLoader from '@components/skeleton/DocumentSimpleLoader'
import DocumentWithPictureLoader from '@components/skeleton/DocumentWithPictureLoader'
import { twMerge } from 'tailwind-merge'

// Shared by SlugPageLoader (pre-mount) and EditorContent (in-layout) so the
// document bones are pixel-identical across the S0→S3 reveal. Section gaps are
// explicit — the bones must not depend on the pad's heading-margin cascade.
const EditorContentSkeleton = ({ className }: { className?: string }) => {
  return (
    <div className={twMerge('ProseMirror tiptap__editor h-full w-full space-y-10', className)}>
      <DocumentSimpleLoader className="heading !h-auto" level="1" />
      <DocumentWithPictureLoader className="heading !h-auto" level="1" />
      <DocumentSimpleLoader className="heading !h-auto" level="1" />
    </div>
  )
}

export default EditorContentSkeleton
