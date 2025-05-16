export const MsgReplyTo = ({ message }: any) => {
  return (
    <div className="bg-base-200 text-base-content mb-1 w-full rounded border-l-4 border-cyan-400 p-1">
      <div className="chat-header text-xs font-bold">
        {message?.replied_message_details?.user?.username}
      </div>
      <p className="m-0 text-sm" dir="auto">
        {message?.replied_message_preview}
      </p>
    </div>
  )
}
