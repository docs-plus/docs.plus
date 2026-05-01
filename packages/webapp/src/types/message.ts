/**
 * Lifecycle of a chat message in the local store.
 * `pending` = optimistic row pre-roundtrip; `sent` = server-confirmed;
 * `failed` = INSERT rejected (UI shows retry). Absent = `sent` (server fetches).
 */
export type MessageStatus = 'pending' | 'sent' | 'failed'
