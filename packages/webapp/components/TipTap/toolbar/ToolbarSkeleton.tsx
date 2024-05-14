const ToolbarSkeleton = () => {
  return (
    <div className="tiptap__toolbar editorButtons flex w-full flex-row items-center justify-between space-x-2 px-1 py-2 sm:justify-start sm:px-4">
      <div className="skeleton h-6 w-28"></div>
      <div className="divider lg:divider-horizontal"></div>

      <div className="skeleton size-6"></div>
      <div className="skeleton size-6"></div>
      <div className="skeleton size-6"></div>
      <div className="divider lg:divider-horizontal"></div>
      <div className="skeleton size-6"></div>
      <div className="skeleton size-6"></div>
      <div className="skeleton size-6"></div>

      <div className="!ml-auto flex space-x-2">
        <div className="skeleton size-6"></div>
        <div className="divider lg:divider-horizontal"></div>
        <div className="skeleton size-6"></div>
        <div className="skeleton size-6"></div>
      </div>
    </div>
  )
}

export default ToolbarSkeleton
