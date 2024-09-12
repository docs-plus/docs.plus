import { MdInsertComment } from 'react-icons/md'

export const MsgComment = ({ data }: any) => {
  return (
    <div className="mb-1 w-full rounded border-l-4 border-cyan-400 bg-base-200 p-1 text-base-content">
      <div className="flex items-center">
        <div className="mr-2">
          <MdInsertComment size={20} />
        </div>
        <p className="m-0 text-sm" dir="auto">
          {data?.metadata?.comment?.content}
        </p>
      </div>
    </div>
  )
}
