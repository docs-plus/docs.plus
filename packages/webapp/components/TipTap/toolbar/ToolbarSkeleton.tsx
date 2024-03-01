const ToolbarSkeleton = () => {
  return (
    <div className="tiptap__toolbar w-full space-x-2 py-2 editorButtons justify-between sm:justify-start flex flex-row items-center px-1 sm:px-4">
      <div className="skeleton h-6 w-28"></div>
      <div className="divider lg:divider-horizontal"></div>

      <div className="skeleton h-6 w-6"></div>
      <div className="skeleton h-6 w-6"></div>
      <div className="skeleton h-6 w-6"></div>
      <div className="divider lg:divider-horizontal"></div>
      <div className="skeleton h-6 w-6"></div>
      <div className="skeleton h-6 w-6"></div>
      <div className="skeleton h-6 w-6"></div>

      <div className="!ml-auto flex space-x-2">
        <div className="skeleton h-6 w-6"></div>
        <div className="divider lg:divider-horizontal"></div>
        <div className="skeleton h-6 w-6"></div>
        <div className="skeleton h-6 w-6"></div>
      </div>
    </div>
  )
}

export default ToolbarSkeleton
