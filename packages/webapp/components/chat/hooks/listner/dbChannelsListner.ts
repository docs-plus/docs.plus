import { channelUpdate, channelInsert } from "./helpers";

export const dbChannelsListner = (payload: any) => {
  if (payload.eventType === "INSERT") {
    channelInsert(payload);
  }
  if (payload.eventType === "UPDATE") {
    channelUpdate(payload);
  }
};
