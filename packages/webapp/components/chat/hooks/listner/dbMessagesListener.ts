import { messageInsert, messageUpdate } from "./helpers";

export const dbMessagesListener = (payload: any) => {
  if (payload.eventType === "INSERT") messageInsert(payload);
  if (payload.eventType === "UPDATE") messageUpdate(payload);
};
