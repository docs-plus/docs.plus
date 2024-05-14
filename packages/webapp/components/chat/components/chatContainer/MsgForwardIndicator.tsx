export const MsgForwardIndicator = ({ forwardMessageOrigin }: any) => {
  return (
    <div className="chat-header text-xs text-primary">
      {forwardMessageOrigin && `Forwarded from: ${forwardMessageOrigin}`}
    </div>
  );
};
