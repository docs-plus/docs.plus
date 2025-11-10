import { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { supabaseServer } from "../supabase";

export const getUser = async (cookieStore: ReadonlyRequestCookies) =>
  await supabaseServer(cookieStore).auth.getUser();
