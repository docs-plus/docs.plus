import DocumentLoader from '@components/skeleton/DocumentLoader'
import { twMerge } from '@utils/twMerge'

// Shared by SlugPageLoader (pre-mount) and EditorContent (in-layout) so the
// document bones are pixel-identical across the S0→S3 reveal. Section gaps are
// explicit — the bones must not depend on the pad's heading-margin cascade.
const EditorContentSkeleton = ({ className }: { className?: string }) => {
  return (
    <div className={twMerge('ProseMirror tiptap__editor h-full w-full space-y-10', className)}>
      <DocumentLoader className="heading !h-auto" />
      <DocumentLoader picture className="heading !h-auto" />
      <DocumentLoader className="heading !h-auto" />
    </div>
  )
}

export default EditorContentSkeleton
