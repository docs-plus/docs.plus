export const MsgReplyTo = ({ data }: any) => {
  return (
    <div className=" mb-1 w-full rounded border-l-4 border-cyan-400 bg-base-200 p-1 text-base-content">
      <div className="chat-header text-xs font-bold">
        {data?.replied_message_details?.user?.username}
      </div>
      <p className="m-0 text-sm" dir="auto">
        {data?.replied_message_preview}
      </p>
    </div>
  );
};
