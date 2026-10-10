import ToolbarDivider from '@components/TipTap/toolbar/ToolbarDivider'

const ButtonBone = () => <div className="skeleton rounded-field size-8 shrink-0" />
const SelectBone = () => <div className="skeleton rounded-field h-8 w-[42px] shrink-0" />

// Mirrors EditorToolbar control for control, so the swap moves no pixel.
const ToolbarSkeleton = ({
  isSignedIn = false,
  hasQr = false
}: {
  isSignedIn?: boolean
  hasQr?: boolean
}) => {
  return (
    <div className="tiptap__toolbar border-base-300 bg-base-100 flex min-w-0 flex-row items-center justify-between gap-0.5 border-b px-3 py-1.5 sm:justify-start">
      <div className="skeleton rounded-field h-8 w-40 shrink-0" />
      <ToolbarDivider />
      {/* Bold, Italic, Underline, Strike, Highlight */}
      <ButtonBone />
      <ButtonBone />
      <ButtonBone />
      <ButtonBone />
      <ButtonBone />
      <ToolbarDivider />
      {/* Media, Comment, Link */}
      <ButtonBone />
      <ButtonBone />
      <ButtonBone />
      <ToolbarDivider />
      {/* Lists, Blockquote, Code */}
      <SelectBone />
      <ButtonBone />
      <SelectBone />
      <ToolbarDivider />
      {/* Clear formatting */}
      <ButtonBone />

      <div className="!ml-auto flex items-center gap-0.5">
        {/* Discord, then Copy */}
        <ButtonBone />
        <ToolbarDivider />
        <ButtonBone />
        {isSignedIn && (
          <>
            {/* Documents, then Bookmarks */}
            <ButtonBone />
            <ToolbarDivider />
            <ButtonBone />
          </>
        )}
        {/* Filter, QR, then Settings */}
        <ButtonBone />
        {hasQr && <ButtonBone />}
        <ToolbarDivider />
        <ButtonBone />
      </div>
    </div>
  )
}

export default ToolbarSkeleton
