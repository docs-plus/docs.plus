# Chatroom Feature — Comprehensive Technical Document

> **Version:** v1.7.0
> **Date:** 2026-02-13
> **Authors:** Engineering, UI/UX, PM Teams
> **Design System Reference:** `Design_System_Global_v2.md` v3.0.0
> **Status:** Living Document — update with every sprint
>
> **Revision History:**
>
> | Version | Date | Author | Sections Changed | Summary |
> |---|---|---|---|---|
> | v1.0.0 | 2026-02-12 | Engineering Team | §1-25 | Initial feature documentation |
> | v1.1.0 | 2026-02-12 | Supabase Core Team | §26 | Backend SQL cross-reference |
> | v1.2.0 | 2026-02-12 | Staff Engineers | §27-29 | DRY/SOLID/KISS audit |
> | v1.3.0 | 2026-02-12 | Staff Engineers | §30 | Trade-off analysis |
> | v1.4.0 | 2026-02-12 | Frontend Architecture | §31 | Compound component audit |
> | v1.5.0 | 2026-02-12 | UI/UX + PM | §32 | Design system compliance audit |
> | v1.6.0 | 2026-02-12 | Technical Writing | §33 | Document quality audit |
> | v1.7.0 | 2026-02-13 | Engineering + UI/UX | §10, §11, §16, §17, §22, §24, §25, §32 | Implementation sync — FK fix, notification toast, resize, toolbar redesign, mobile breadcrumb, EditFAB fix |

---

## Table of Contents

1. [Feature Overview](#1-feature-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Database Schema (Backend)](#3-database-schema-backend)
4. [Supabase RPC Functions (Backend)](#4-supabase-rpc-functions-backend)
5. [Real-Time Subscriptions (Backend)](#5-real-time-subscriptions-backend)
6. [API Layer (Frontend ↔ Backend Bridge)](#6-api-layer-frontend--backend-bridge)
7. [State Management (Frontend)](#7-state-management-frontend)
8. [Component Architecture (Frontend)](#8-component-architecture-frontend)
9. [Hooks Inventory (Frontend)](#9-hooks-inventory-frontend)
10. [Desktop Implementation](#10-desktop-implementation)
11. [Mobile Implementation](#11-mobile-implementation)
12. [Message Composer System](#12-message-composer-system)
13. [Message Actions & Interactions](#13-message-actions--interactions)
14. [Virtualization & Infinite Scroll](#14-virtualization--infinite-scroll)
15. [Draft Persistence (IndexedDB)](#15-draft-persistence-indexeddb)
16. [Channel Access Control](#16-channel-access-control)
17. [Notification System (Per-Channel)](#17-notification-system-per-channel)
18. [Emoji & Reactions](#18-emoji--reactions)
19. [Threads](#19-threads)
20. [Pinned Messages & Bookmarks](#20-pinned-messages--bookmarks)
21. [Read Receipts & Unread Tracking](#21-read-receipts--unread-tracking)
22. [Design System Compliance](#22-design-system-compliance)
23. [File Inventory](#23-file-inventory)
24. [Known Issues & Tech Debt](#24-known-issues--tech-debt)
25. [Roadmap & Recommendations](#25-roadmap--recommendations)

---

## 1. Feature Overview

The **Chatroom** feature is a contextual, heading-scoped messaging system embedded within the document editor. Every heading in a document is a potential channel. When a user opens a chat on a heading, a channel is either fetched or created on the fly.

### Core Capabilities

| Capability                | Desktop | Mobile | Status     |
|---------------------------|---------|--------|------------|
| Send / receive messages   | ✅      | ✅     | Production |
| Rich text (TipTap)        | ✅      | ✅     | Production |
| Reply to message          | ✅      | ✅     | Production |
| Edit own message          | ✅      | ✅     | Production |
| Delete own message        | ✅      | ✅     | Production |
| Emoji reactions           | ✅      | ✅     | Production |
| @mentions                 | ✅      | ✅     | Production |
| Bookmarks                 | ✅      | ✅     | Production |
| Pinned messages           | ✅      | ✅     | Production |
| Threads                   | ✅      | Partial| Production |
| Message forwarding        | —       | —      | Planned    |
| Infinite scroll (bi-dir)  | ✅      | ✅     | Production |
| Unread indicator line     | ✅      | ✅     | Production |
| Date separators           | ✅      | ✅     | Production |
| Read receipts             | ✅      | ✅     | Production |
| Typing indicators         | ✅      | ✅     | Production |
| Per-channel notifications | ✅      | ✅     | Production |
| Share chatroom URL        | ✅      | ✅     | Production |
| Participants list         | ✅      | —      | Production |
| Resize panel (desktop)    | ✅      | N/A    | Production |
| Long-press actions        | N/A     | ✅     | Production |
| Hover menu actions        | ✅      | N/A    | Production |
| Draft persistence (IDB)   | ✅      | ✅     | Production |
| Breadcrumb navigation     | ✅      | ✅     | Production |
| Copy message to doc       | ✅      | —      | Production |
| Deep link to message      | ✅      | ✅     | Production |
| Comment on doc selection   | ✅      | ✅     | Production |

---

## 2. Architecture Overview

### High-Level Data Flow

```
┌────────────────────────────────────────────────────────────────────┐
│                        BROWSER (React)                             │
│                                                                    │
│  ┌─────────────────────┐     ┌───────────────────────────────┐    │
│  │  useChatStore        │◄────│  Supabase Realtime            │    │
│  │  (Zustand + Immer)   │     │  postgres_changes on messages │    │
│  │                      │     │  postgres_changes on channels │    │
│  │  • chatRoom state    │     └───────────────────────────────┘    │
│  │  • messagesByChannel │                                         │
│  │  • workspaceSettings │     ┌───────────────────────────────┐   │
│  │  • channelMembers    │     │  Supabase REST (RPC)          │   │
│  │  • pinnedMessages    │◄────│  • get_channel_aggregate_data │   │
│  │  • threads           │     │  • get_channel_messages_paged │   │
│  │  • bookmarks         │     │  • messages CRUD              │   │
│  │  • emojiPicker       │     │  • channel_members CRUD       │   │
│  └─────────────────────┘     └───────────────────────────────┘   │
│           │                                                       │
│           ▼                                                       │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  <Chatroom variant="desktop|mobile">                        │ │
│  │    └→ ChatroomProvider (context)                             │ │
│  │       ├→ useChannelInitialData  (fetch + hydrate)           │ │
│  │       ├→ useMessageSubscription (realtime listener)         │ │
│  │       ├→ ChatroomToolbar (breadcrumb, share, notif, close)  │ │
│  │       ├→ MessageFeed                                        │ │
│  │       │  ├→ MessageFeedProvider (infinite scroll, scroll)   │ │
│  │       │  ├→ MessageList                                     │ │
│  │       │  │  ├→ MessageListProvider (messages, read tracking)│ │
│  │       │  │  ├→ MessageLoop (@tanstack/react-virtual)        │ │
│  │       │  │  │  ├→ DateChip                                  │ │
│  │       │  │  │  ├→ UnreadIndicatorLine                       │ │
│  │       │  │  │  ├→ SystemNotifyChip                          │ │
│  │       │  │  │  └→ MessageCard (per message)                 │ │
│  │       │  │  │     ├→ Header (avatar, username, timestamp)   │ │
│  │       │  │  │     ├→ Content (body, reply ref, comment ref) │ │
│  │       │  │  │     ├→ Footer (reactions, indicators)         │ │
│  │       │  │  │     ├→ Actions (hover menu / long press)      │ │
│  │       │  │  │     └→ MessageCardContext                     │ │
│  │       │  │  └→ ContextMenu (right-click)                    │ │
│  │       │  └→ ScrollToBottomButton                            │ │
│  │       └→ ChannelComposer                                    │ │
│  │          ├→ AccessControl (permission routing)              │ │
│  │          └→ MessageComposer (TipTap editor)                 │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                        SUPABASE (Backend)                          │
│                                                                    │
│  Tables:           │  RPC Functions:                               │
│  • channels        │  • get_channel_aggregate_data()               │
│  • messages        │  • get_channel_messages_paginated()           │
│  • channel_members │  • create_thread_message()                    │
│  • pinned_messages │  • upsert_channel()                           │
│  • message_bookmarks│ • join_channel()                             │
│  • users           │  • mark_read_messages()                       │
│                    │  • get/update_channel_notif_state()            │
│  Realtime:         │                                               │
│  • postgres_changes│  Enums:                                       │
│    on messages     │  • channel_type (PUBLIC, PRIVATE, BROADCAST,  │
│    on channels     │    ARCHIVE, DIRECT, GROUP, THREAD)            │
│                    │  • message_type (text, image, video, audio,   │
│                    │    link, giphy, file, notification)            │
│                    │  • channel_member_role (ADMIN, MODERATOR,     │
│                    │    MEMBER, GUEST)                              │
│                    │  • channel_notification_state (ALL, MENTIONS,  │
│                    │    MUTED)                                      │
└────────────────────────────────────────────────────────────────────┘
```

### Design Pattern: Compound Components

The chatroom uses the **Compound Component** pattern extensively. This gives consumers (pages) full control over layout and composition while the library provides behavior and state.

```tsx
// Consumer decides the layout — library provides the blocks
<Chatroom variant="desktop">
  <Chatroom.Toolbar>
    <Chatroom.Toolbar.Breadcrumb />
    <Chatroom.Toolbar.ShareButton />
  </Chatroom.Toolbar>
  <Chatroom.MessageFeed>
    <Chatroom.MessageFeed.MessageList>
      <Chatroom.MessageFeed.MessageList.Loop>
        {(message, index) => (
          <Chatroom.MessageFeed.MessageList.MessageCard message={message} index={index}>
            {/* Fully composable message layout */}
          </Chatroom.MessageFeed.MessageList.MessageCard>
        )}
      </Chatroom.MessageFeed.MessageList.Loop>
    </Chatroom.MessageFeed.MessageList>
  </Chatroom.MessageFeed>
  <Chatroom.ChannelComposer />
</Chatroom>
```

---

## 3. Database Schema (Backend)

### 3.1 `channels` Table

| Column                     | Type          | Default               | Description                                      |
|----------------------------|---------------|-----------------------|--------------------------------------------------|
| `id`                       | `varchar(36)` | `uuid_generate_v4()`  | Primary key — matches the document heading ID     |
| `workspace_id`             | `varchar(36)` | —                     | FK → `workspaces.id` (CASCADE)                    |
| `created_at`               | `timestamptz` | `now()`               | Creation timestamp                                |
| `updated_at`               | `timestamptz` | `now()`               | Last update timestamp                             |
| `slug`                     | `text`        | —                     | URL-friendly identifier (unique, lowercase)       |
| `name`                     | `text`        | —                     | Display name (max 100 chars)                      |
| `created_by`               | `uuid`        | —                     | FK → `users.id`                                   |
| `description`              | `text`        | —                     | Channel description (max 1000 chars)              |
| `member_limit`             | `int`         | —                     | Max members (null = unlimited)                    |
| `last_activity_at`         | `timestamptz` | `now()`               | Timestamp of most recent activity                 |
| `last_message_preview`     | `text`        | —                     | Preview of last message                           |
| `is_avatar_set`            | `boolean`     | `false`               | Whether custom avatar is set                      |
| `allow_emoji_reactions`    | `boolean`     | `true`                | Whether emoji reactions are allowed               |
| `mute_in_app_notifications`| `boolean`     | `false`               | Channel-level notification mute                   |
| `type`                     | `channel_type`| `PUBLIC`              | Channel type enum                                 |
| `metadata`                 | `jsonb`       | `{}`                  | Extensible metadata                               |
| `member_count`             | `int`         | `0`                   | Member count (denormalized for performance)       |
| `deleted_at`               | `timestamptz` | —                     | Soft delete timestamp                             |

**Constraints:**
- `check_slug_format`: slug must match `^[a-z0-9]+(?:-[a-z0-9]+)*$`
- Unique on `slug`

### 3.2 `messages` Table

| Column                     | Type           | Default              | Description                                       |
|----------------------------|----------------|----------------------|---------------------------------------------------|
| `id`                       | `uuid`         | `uuid_generate_v4()` | Primary key                                       |
| `created_at`               | `timestamptz`  | `now()`              | Creation timestamp                                |
| `updated_at`               | `timestamptz`  | `now()`              | Last update timestamp                             |
| `deleted_at`               | `timestamptz`  | —                    | Soft delete timestamp                             |
| `edited_at`                | `timestamptz`  | —                    | When content was last edited                      |
| `content`                  | `text`         | —                    | Plain text content (max 3000 chars)               |
| `html`                     | `text`         | —                    | Rich HTML content (max 3000 chars)                |
| `medias`                   | `jsonb`        | —                    | Media attachments `[{url, type, description}]`    |
| `user_id`                  | `uuid`         | —                    | FK → `users.id` (author)                          |
| `channel_id`               | `varchar(36)`  | —                    | FK → `channels.id` (CASCADE)                      |
| `reactions`                | `jsonb`        | —                    | `{"👍": [{user_id, created_at}], ...}`            |
| `type`                     | `message_type` | `text`               | Message type enum                                 |
| `metadata`                 | `jsonb`        | —                    | Extensible metadata (thread info, forwarding)     |
| `reply_to_message_id`      | `uuid`         | —                    | FK → `messages.id` (self-ref, reply)              |
| `replied_message_preview`  | `text`         | —                    | Cached preview of replied message                 |
| `origin_message_id`        | `uuid`         | —                    | FK → `messages.id` (forwarded message source)     |
| `thread_id`                | `uuid`         | —                    | FK → `messages.id` (thread parent)                |
| `thread_depth`             | `int`          | `0`                  | Nesting level in thread                           |
| `is_thread_root`           | `boolean`      | `false`              | Whether message starts a thread                   |
| `thread_owner_id`          | `uuid`         | —                    | FK → `users.id` (thread creator)                  |
| `readed_at`                | `timestamptz`  | —                    | When message was last read                        |

### 3.3 `channel_members` Table

| Column                     | Type                       | Default     | Description                                  |
|----------------------------|----------------------------|-------------|----------------------------------------------|
| `id`                       | `uuid`                     | PK          | Membership record ID                         |
| `channel_id`               | `varchar(36)`              | —           | FK → `channels.id`                           |
| `member_id`                | `uuid`                     | —           | FK → `users.id`                              |
| `last_read_message_id`     | `uuid`                     | —           | FK → `messages.id` (last read)               |
| `last_read_update_at`      | `timestamptz`              | `now()`     | When read status was updated                 |
| `joined_at`                | `timestamptz`              | `now()`     | When user joined channel                     |
| `left_at`                  | `timestamptz`              | —           | When user left channel                       |
| `mute_in_app_notifications`| `boolean`                  | `false`     | Per-member notification mute                 |
| `notif_state`              | `channel_notification_state`| `MENTIONS` | ALL / MENTIONS / MUTED                       |
| `channel_member_role`      | `channel_member_role`      | `MEMBER`    | ADMIN / MODERATOR / MEMBER / GUEST           |
| `unread_message_count`     | `int`                      | `0`         | Unread count per member                      |

### 3.4 `pinned_messages` Table

| Column        | Type           | Description                          |
|---------------|----------------|--------------------------------------|
| `id`          | `uuid`         | PK                                   |
| `channel_id`  | `varchar(36)`  | FK → `channels.id`                   |
| `message_id`  | `uuid`         | FK → `messages.id`                   |
| `pinned_at`   | `timestamptz`  | When message was pinned              |
| `pinned_by`   | `uuid`         | FK → `users.id`                      |
| `content`     | `text`         | Cached content for quick display     |

**Constraint:** unique `(channel_id, message_id)`

### 3.5 `message_bookmarks` Table

| Column        | Type           | Description                          |
|---------------|----------------|--------------------------------------|
| `id`          | `bigint`       | PK (auto-generated identity)         |
| `user_id`     | `uuid`         | FK → `users.id`                      |
| `message_id`  | `uuid`         | FK → `messages.id`                   |
| `created_at`  | `timestamptz`  | When bookmarked                      |
| `updated_at`  | `timestamptz`  | Last update                          |
| `archived_at` | `timestamptz`  | When archived                        |
| `marked_at`   | `timestamptz`  | When marked as read                  |
| `metadata`    | `jsonb`        | For folders, tags, priority, etc.    |

**Constraint:** unique `(user_id, message_id)`
**RLS:** Enabled — users can only CRUD their own bookmarks.

### 3.6 Enum Types

```sql
channel_type:      PUBLIC | PRIVATE | BROADCAST | ARCHIVE | DIRECT | GROUP | THREAD
message_type:      text | image | video | audio | link | giphy | file | notification
channel_member_role: ADMIN | MODERATOR | MEMBER | GUEST
channel_notification_state: ALL | MENTIONS | MUTED
user_status:       ONLINE | OFFLINE | AWAY | BUSY | INVISIBLE | TYPING
```

---

## 4. Supabase RPC Functions (Backend)

### `get_channel_aggregate_data(input_channel_id, message_limit?, anchor_message_id?)`

**Purpose:** Initial data hydration when a chatroom opens.

**Returns:**

| Field                          | Type     | Description                                     |
|--------------------------------|----------|-------------------------------------------------|
| `channel_info`                 | `JSONB`  | Channel metadata                                |
| `last_messages`                | `JSONB`  | Last N messages (with user details, reactions)   |
| `pinned_messages`              | `JSONB`  | All pinned messages for the channel              |
| `is_user_channel_member`       | `BOOLEAN`| Whether the current user is a member             |
| `channel_member_info`          | `JSONB`  | Current user's membership details                |
| `total_messages_since_last_read`| `INT`   | Unread count since last read                     |
| `unread_message`               | `BOOLEAN`| Whether there are unread messages                |
| `last_read_message_id`         | `UUID`   | Last message the user read                       |
| `last_read_message_timestamp`  | `TIMESTAMPTZ`| Timestamp of last read                       |
| `anchor_message_timestamp`     | `TIMESTAMPTZ`| For deep-linking to a specific message        |

**Key behaviors:**
- If `anchor_message_id` is provided, fetches messages around that anchor (half before, half after)
- Joins user details into messages via `user_details_json()` helper
- Includes bookmark status per message
- Filters out system notifications (user_join_channel, channel_created)

### `get_channel_messages_paginated(input_channel_id, limit_count?, cursor_timestamp?, direction?)`

**Purpose:** Cursor-based pagination for infinite scroll.

**Parameters:**
- `direction`: `'older'` or `'newer'`
- `cursor_timestamp`: Timestamp cursor for pagination

**Returns:**

| Field               | Type    | Description                                       |
|---------------------|---------|---------------------------------------------------|
| `messages`          | `JSONB` | Array of messages with user details               |
| `pagination_cursors`| `JSONB` | `{older_cursor, newer_cursor, has_more_older, has_more_newer}` |

---

## 5. Real-Time Subscriptions (Backend)

### Supabase Realtime — `postgres_changes`

**Subscription:**

```typescript
supabaseClient
  .channel(`channel:${channelId}`)
  .on('postgres_changes', {
    event: '*',           // INSERT, UPDATE, DELETE
    schema: 'public',
    table: 'messages',
    filter: `channel_id=eq.${channelId}`
  }, dbMessagesListener)
  .subscribe()
```

**Listener routing:**
- `INSERT` → `messageInsert()` — Adds new message to store, resolves user details from presence cache, groups with adjacent messages
- `UPDATE` → `messageUpdate()` — Updates message in store, handles soft deletes (`deleted_at` set)

**Offline handling:**
- Subscription is skipped if `navigator.onLine` is `false`
- `offline` event triggers `unsubscribe()`
- Prevents retry spam when disconnected

### Presence Broadcasting

User presence is broadcast when entering a chatroom:
```typescript
broadcastPresence(broadcaster, user, headingId)
```
- Users are tracked in `useStore.usersPresence` Map
- `ParticipantsList` component reads presence to show active users

---

## 6. API Layer (Frontend ↔ Backend Bridge)

### Messages API

| Function                      | File                                  | Description                             |
|-------------------------------|---------------------------------------|-----------------------------------------|
| `sendMessage()`               | `api/messages/sendMessage.ts`         | Insert message (Supabase `.insert()`)   |
| `sendThreadMessage()`         | `api/messages/sendMessage.ts`         | Insert thread reply                     |
| `updateMessage()`             | `api/messages/` (implied)             | Update message content                  |
| `sendCommentMessage()`        | `api/` (implied)                      | Send comment on document selection      |
| `createThreadMessage()`       | `api/` (RPC)                          | Create a thread message via RPC         |
| `getAllMessages()`            | `api/messages/getAllMessages.ts`      | Fetch all messages (fallback)           |
| `fetchChannelInitialData()`   | `api/rpc/fetchChannelInitialData.ts`  | RPC → `get_channel_aggregate_data`      |
| `fetchMessagesPaginated()`    | `api/rpc/fetchMessagesPaginated.ts`   | RPC → `get_channel_messages_paginated`  |
| `markReadMessages()`          | `api/` (implied)                      | Mark messages as read                   |

### Channel API

| Function                      | File                                  | Description                             |
|-------------------------------|---------------------------------------|-----------------------------------------|
| `upsertChannel()`            | `api/`                                | Create or update a channel              |
| `join2Channel()`             | `api/`                                | Join a channel                          |
| `getChannelNotifState()`     | `api/`                                | Get notification preference             |
| `updateChannelNotifState()`  | `api/`                                | Update notification preference          |
| `getUserById()`              | `api/`                                | Fetch user profile                      |

---

## 7. State Management (Frontend)

### `useChatStore` — Main Zustand Store

Composed of **8 sub-stores** merged via `create()`:

| Sub-Store                  | File                          | Responsibility                               |
|----------------------------|-------------------------------|----------------------------------------------|
| `chatRoom`                 | `stores/chat/chatroom.ts`     | Active chatroom state (headingId, open, panel height, editor ref) |
| `channelMessagesStore`     | `stores/chat/channelMessagesStore.ts` | `messagesByChannel: Map<channelId, Map<msgId, msg>>` |
| `workspaceSettingsStore`   | `stores/chat/workspaceSettingsStore.ts` | Per-channel settings (unread, last read, scroll offset) |
| `channelMembersStore`      | `stores/chat/channelMembersStore.ts` | Channel membership data |
| `channelPinnedMessagesStore`| `stores/chat/...`            | Pinned messages per channel |
| `channelsStore`            | `stores/chat/channelsStore.ts`| Channel metadata cache |
| `threadStore`              | `stores/chat/threadStore.ts`  | Active thread state (`startThreadMessage`, `threadMessages`) |
| `bookmarkStore`            | `stores/chat/...`             | User bookmarks |
| `emojiPickerStore`         | `stores/chat/...`             | Emoji picker state |

**Key state shape:**

```typescript
interface IChatroomStore {
  chatRoom: {
    headingId?: string          // Active channel (heading) ID
    documentId?: string         // Parent document ID
    headingPath: Array<any>     // Breadcrumb path
    open: boolean               // Panel visibility
    pannelHeight: number        // Desktop panel height (px)
    isReadyToDisplayMessages: boolean  // Guards rendering until data loaded
    editorInstance?: Editor     // TipTap editor ref
    editorRef?: HTMLDivElement  // Editor DOM ref
    fetchMsgsFromId?: string    // Deep-link anchor message ID
    disableScroll: boolean      // Scroll lock
  }
}
```

### Context Providers (Frontend)

| Context                  | File                              | Scope                                     |
|--------------------------|-----------------------------------|-----------------------------------------|
| `ChatroomContext`        | `ChatroomContext.tsx`             | Channel ID, variant, loading states, dialog API |
| `MessageFeedContext`     | `MessageFeed/MessageFeedContext.tsx` | Infinite scroll state, virtualizer ref, container ref |
| `MessageListContext`     | `MessageList/MessageListContext.tsx` | Messages array, scroll direction, mention handler |
| `MessageCardContext`     | `MessageCard/MessageCardContext.tsx` | Single message data, card ref, emoji-only flag |
| `MessageComposerContext` | `MessageComposer/context/...`    | Editor instance, submit handler, toolbar state |
| `ChannelContext`         | `context/ChannelProvider.tsx`     | Legacy channel settings (contextMenu, textEditor options) |
| `EmojiPanelContext`      | `EmojiPanel/context/...`         | Emoji picker variant + state |

---

## 8. Component Architecture (Frontend)

### Compound Component Tree

```
Chatroom (root)
├── Chatroom.Toolbar
│   ├── Chatroom.Toolbar.Breadcrumb
│   ├── Chatroom.Toolbar.ParticipantsList
│   ├── Chatroom.Toolbar.ShareButton
│   ├── Chatroom.Toolbar.NotificationToggle
│   └── Chatroom.Toolbar.CloseButton
│
├── Chatroom.MessageFeed
│   ├── Chatroom.MessageFeed.ScrollToBottom
│   ├── Chatroom.MessageFeed.PinnedMessages
│   └── Chatroom.MessageFeed.MessageList
│       ├── Chatroom.MessageFeed.MessageList.ContextMenu
│       └── Chatroom.MessageFeed.MessageList.Loop
│           └── Chatroom.MessageFeed.MessageList.MessageCard
│               ├── .Header
│               │   ├── .Header.UserAvatar
│               │   ├── .Header.Username
│               │   ├── .Header.Timestamp
│               │   └── .Header.BookmarkIndicator
│               ├── .Content
│               │   ├── .Content.ReplyReference
│               │   ├── .Content.CommentReference
│               │   └── .Content.MessageBody
│               ├── .Footer
│               │   ├── .Footer.Indicators
│               │   │   ├── .Footer.Indicators.ReplyCount
│               │   │   ├── .Footer.Indicators.EditedBadge
│               │   │   └── .Footer.Indicators.MessageSeen
│               │   └── .Footer.Reactions
│               │       ├── .Footer.Reactions.AddReactionButton
│               │       └── .Footer.Reactions.ReactionList
│               ├── .Actions
│               │   ├── .Actions.HoverMenu (desktop)
│               │   ├── .Actions.EmojiReaction
│               │   ├── .Actions.Reply
│               │   ├── .Actions.ReplyInThread
│               │   ├── .Actions.Bookmark
│               │   ├── .Actions.CopyLink
│               │   ├── .Actions.CopyToDoc
│               │   ├── .Actions.Delete
│               │   ├── .Actions.Edit
│               │   ├── .Actions.ReadStatus
│               │   └── .Actions.GroupAuth
│               └── .LongPressMenu (mobile)
│
├── Chatroom.ChannelComposer
│   ├── .AccessControl (smart permission routing)
│   ├── .SignInPrompt
│   ├── .JoinGroup
│   ├── .JoinPrivate
│   ├── .JoinDirect
│   ├── .JoinBroadcast
│   └── .MsgComposer (→ MessageComposer)
│       ├── .Editor (layout: Desktop or Mobile)
│       ├── .Toolbar (bold, italic, code, etc.)
│       ├── .Context (reply, edit, comment indicators)
│       ├── .Actions (emoji, mention, send, attach)
│       └── .Input
│
└── Chatroom.Layout (auto-selects Desktop/Mobile)
    ├── DesktopLayout (resize handle, absolute positioned)
    └── MobileLayout (sheet header, close button)
```

---

## 9. Hooks Inventory (Frontend)

### Core Data Hooks

| Hook                          | File                                   | Purpose                                        |
|-------------------------------|----------------------------------------|------------------------------------------------|
| `useChannelInitialData`       | `hooks/useChannleInitialData.ts`       | Fetches initial channel data, messages, settings; auto-creates channel if needed |
| `useMessageSubscription`      | `hooks/useMessageSubscription.ts`      | Subscribes to Supabase Realtime `postgres_changes` on messages table |
| `useInfiniteLoadMessages`     | `hooks/useInfiniteLoadMessages.ts`     | Bi-directional infinite scroll via IntersectionObserver + cursor pagination |
| `useAutoScrollForNewMessages` | `hooks/useAutoScrollForNewMessages.ts` | Auto-scrolls to bottom when new messages arrive (if near bottom or own message) |
| `useScrollAndLoad`            | `hooks/useScrollAndLoad.ts`            | Initial scroll positioning (last read message or bottom); sets `isReadyToDisplayMessages` |
| `useHighlightMessage`         | `hooks/useHighlightMessage.ts`         | Highlights a deep-linked message on load |
| `useCheckReadMessage`         | `hooks/useCheckReadMessage.ts`         | Tracks visible messages via virtualizer; marks as read via API |

### UI/UX Hooks

| Hook                          | File                                   | Purpose                                        |
|-------------------------------|----------------------------------------|------------------------------------------------|
| `useViewportObserver`         | `hooks/useViewportObserver.ts`         | Generic IntersectionObserver wrapper           |
| `useMentionClick`             | `hooks/useMentionClick.tsx`            | Handles @mention click navigation              |
| `useEmojiBoxHandler`          | `hooks/useEmojiBoxHandler.ts`          | Emoji picker open/close logic                  |
| `useNotificationToggle`       | `hooks/useNotificationToggle.ts`       | Per-channel notification cycle (ALL → MENTIONS → MUTED) |
| `useChatContainerResizeHandler`| `hooks/useChatContainerResizeHandler.ts`| Desktop panel resize logic                    |

### Message Card Hooks

| Hook                          | File                                   | Purpose                                        |
|-------------------------------|----------------------------------------|------------------------------------------------|
| `useBookmarkMessageHandler`   | `MessageCard/hooks/...`                | Toggle bookmark on/off                         |
| `useCopyMessageLinkHandler`   | `MessageCard/hooks/...`                | Copy deep-link URL to clipboard                |
| `useCopyMessageToDocHandler`  | `MessageCard/hooks/...`                | Copy message content into the document         |
| `useDeleteMessageHandler`     | `MessageCard/hooks/...`                | Soft-delete with confirmation dialog           |
| `useEditMessageHandler`       | `MessageCard/hooks/...`                | Enter edit mode in composer                    |
| `usePinMessageHandler`        | `MessageCard/hooks/...`                | Pin/unpin message                              |
| `useReplyInMessageHandler`    | `MessageCard/hooks/...`                | Set reply context in composer                  |
| `useReplyInThreadHandler`     | `MessageCard/hooks/...`                | Open thread and set context                    |
| `useLongPressInteraction`     | `MessageCard/hooks/...`                | Mobile long-press detection for action menu    |
| `useMenuPositioning`          | `MessageCard/hooks/...`                | Menu placement calculation                     |
| `useMenuVisibility`           | `MessageCard/hooks/...`                | Toggle context menu visibility                 |
| `useMessageHighlighting`      | `MessageCard/hooks/...`                | Highlight animation for a message              |

### Realtime Listener Helpers

| Helper                        | File                                     | Purpose                                      |
|-------------------------------|------------------------------------------|----------------------------------------------|
| `dbMessagesListener`          | `hooks/listner/dbMessagesListener.ts`    | Routes INSERT/UPDATE to helpers              |
| `dbChannelsListner`           | `hooks/listner/dbChannelsListner.ts`     | Routes channel INSERT/UPDATE                 |
| `messageInsert`               | `hooks/listner/helpers/messageInsert.ts` | Handles new message: resolves user, groups, updates store |
| `messageUpdate`               | `hooks/listner/helpers/messageUpdate.ts` | Handles message edit/delete in store         |
| `channelInsert`               | `hooks/listner/helpers/channelInsert.ts` | Handles new channel                          |
| `channelUpdate`               | `hooks/listner/helpers/channelUpdate.ts` | Handles channel metadata update              |
| `channelMessageCountsInsert`  | `hooks/listner/helpers/...`              | Handles message count changes                |

---

## 10. Desktop Implementation

### Location

`packages/webapp/src/components/pages/document/components/DesktopEditor.tsx`

### Layout

- **Position:** Absolute-bottom panel within the editor container
- **Resize:** Invisible 6px hit-area resize handle via `useResizeContainer` (visual grabber pill removed — v1.7.0)
- **Default height:** 410px (stored in `chatRoom.pannelHeight`)
- **Min height:** 320px
- **Max height:** 1200px (or 85% of viewport, whichever is smaller) — updated from 520px/70% in v1.7.0
- **Height persisted:** `localStorage` key `docsy:chat-height`

### Key features

1. **Breadcrumb navigation** — Shows heading path, clicking navigates to that heading's chat
2. **Participants list** — Avatar stack of online users in this channel
3. **Toolbar actions** — Share URL, notification toggle, close button
4. **Hover menu on messages** — Shows on mouse hover over message card (emoji, reply, thread, bookmark, more)
5. **Right-click context menu** — Full action set on right-click
6. **Virtualized message list** — `@tanstack/react-virtual` for performance with large message lists

### Message Card Layout (Desktop)

```
┌──────────────────────────────────────────────────┐
│ 📌 Bookmark Indicator                            │
│ ┌─────┐ ┌──────────────────────────────────────┐ │
│ │     │ │ Username         12:34 PM            │ │
│ │ 🧑  │ │ ┌─ Reply Reference ─────────────────┐│ │
│ │     │ │ │ @ replying to: "original msg..."  ││ │
│ │     │ │ └───────────────────────────────────┘│ │
│ └─────┘ │ Message content goes here...         │ │
│         │                                      │ │
│         │ [👍 3] [❤️ 1] [➕]    ↩️ 2 replies  │ │
│         └──────────────────────────────────────┘ │
│                                     [hover menu] │
└──────────────────────────────────────────────────┘
```

---

## 11. Mobile Implementation

### Location

`packages/webapp/src/components/pages/document/components/chat/ChatContainerMobile.tsx`

### Layout

- **Container:** Opens in a bottom sheet (using `react-modal-sheet`)
- **Header:** Custom `ChatRoomHeader` with two-line `BreadcrumbMobile` + action group (`ShareButton`, `NotificationToggle`, `CloseButton`) — redesigned in v1.7.0 from legacy `SheetHeader` + `CopyUrlButton`
- **Chat style:** WhatsApp-style bubbles (DaisyUI `chat-bubble` classes)
  - Owner messages: right-aligned (`chat-end`), custom background color
  - Other messages: left-aligned (`chat-start`)

### Key differences from desktop

| Aspect               | Desktop                    | Mobile                         |
|----------------------|----------------------------|--------------------------------|
| Panel position       | Bottom of editor           | Bottom sheet (full screen)     |
| Message layout       | Slack-style (left-aligned) | WhatsApp-style (chat bubbles)  |
| Message actions      | Hover menu                 | Long-press menu                |
| Toolbar              | Always visible (default `bg-base-100 border-b px-3 py-1.5`) | Compact action group (`ShareButton` + `NotificationToggle` + `CloseButton`, all `size="sm"` / 44px touch targets) |
| Context menu         | Right-click                | Long-press                     |
| Emoji picker         | Popover                    | Bottom sheet (react-modal-sheet)|
| Resize               | Invisible 6px handle (max 85% viewport) | N/A                |
| Breadcrumb           | In toolbar                 | Two-line stacked header: muted ancestor path + primary current heading |
| Channel settings     | Legacy `ChannelProvider`   | Reduced feature set            |

### Mobile-specific configurations

```typescript
const initSettings = {
  displayChannelBar: false,
  pickEmoji: true,
  textEditor: {
    toolbar: false,       // Simplified mobile toolbar
    emojiPicker: false,   // Uses sheet-based picker
    attachmentButton: false
  },
  contextMenue: {
    replyInThread: true,
    forward: false,       // Disabled on mobile
    pin: false            // Disabled on mobile
  }
}
```

---

## 12. Message Composer System

### Architecture

`MessageComposer.tsx` is the brain of the input area. It manages:

1. **TipTap Rich Text Editor** (`useTiptapEditor`)
   - Extensions: StarterKit, InlineCode, Indent, CodeBlockLowlight (syntax highlighting), Mention, Placeholder, Hyperlink
   - Languages: HTML, CSS, JS, TS, Markdown, Python, YAML, JSON, Bash
   - Keyboard shortcuts: `Enter` = send, `Shift+Enter` = new line, `Cmd+Enter` = TipTap default
   - Typing indicator dispatched on content change

2. **Message Context** (reply / edit / comment)
   - `contextType` derived from `replyMessageMemory`, `editMessageMemory`, `commentMessageMemory`
   - Visual indicator bar above the editor shows the context

3. **Content pipeline**

   ```
   User types → TipTap → onUpdate → sanitizeMessageContent() → chunkHtmlContent(3000) → sendMessage()
   ```

   - Messages > 3000 chars are chunked and sent as multiple messages
   - Content is sanitized (XSS prevention)

4. **Draft persistence** (IndexedDB)
   - Auto-saves every 500ms (debounced) to IndexedDB via `setComposerStateDebounced()`
   - Restores draft on mount or channel change
   - Cleared after successful send

5. **Optimistic updates** (fake message)
   - Immediately inserts a `fake_id` message into the store
   - Real message replaces it when Realtime subscription fires

### Composer Sub-Components

| Component                | Purpose                                               |
|--------------------------|-------------------------------------------------------|
| `Editor`                 | Auto-selects DesktopLayout or MobileLayout            |
| `DesktopLayout`          | Full-featured editor with toolbar toggle              |
| `MobileLayout`           | Compact editor with minimal actions                   |
| `Toolbar`                | Formatting buttons (bold, italic, code, list, etc.)   |
| `Context`                | Shows reply/edit/comment indicator bar                |
| `Actions`                | Send, emoji, mention, attachment, toolbar toggle       |
| `Input`                  | TipTap EditorContent wrapper                          |

---

## 13. Message Actions & Interactions

### Desktop — Hover Menu

Appears on hover over a message card. Located in `MessageCard/components/MessageActions/HoverMenuActions.tsx`.

```
[😀 Emoji] [↩️ Reply] [🧵 Thread] [🔖 Bookmark] [⋮ More ▼]
                                                     ├── Copy to Doc
                                                     ├── Copy Link
                                                     ├── ─────────── (owner only)
                                                     ├── Delete
                                                     ├── Edit
                                                     └── Read Status
```

### Mobile — Long-Press Menu

Triggered via `useLongPressInteraction` hook on `MessageCard.LongPressMenu`.

### Action Hooks

Each action is encapsulated in its own hook for SRP:

- **Reply** → `useReplyInMessageHandler` → Sets `replyMessageMemory` in store → Composer shows reply bar
- **Edit** → `useEditMessageHandler` → Sets `editMessageMemory` → Composer loads message content
- **Delete** → `useDeleteMessageHandler` → Shows confirmation dialog → Soft-deletes message
- **Bookmark** → `useBookmarkMessageHandler` → Toggles bookmark via API
- **Pin** → `usePinMessageHandler` → Inserts/removes from `pinned_messages` table
- **Thread** → `useReplyInThreadHandler` → Opens thread panel, creates THREAD channel
- **Copy Link** → `useCopyMessageLinkHandler` → Constructs deep-link URL with `msg_id` param
- **Copy to Doc** → `useCopyMessageToDocHandler` → Inserts message content into TipTap doc
- **Emoji Reaction** → Inline emoji picker → Updates `reactions` JSONB on message

---

## 14. Virtualization & Infinite Scroll

### Technology

- **Virtualizer:** `@tanstack/react-virtual` (`useVirtualizer`)
- **Scroll detection:** `IntersectionObserver` on top/bottom sentinel elements

### Implementation

```
┌──────────────────────────────┐
│ ▲ #top-sentinel (1px)        │ ← IntersectionObserver triggers loadOlderMessages()
│                              │
│   [Date Chip]                │
│   [Message 1]                │  ← Virtual items rendered by @tanstack/react-virtual
│   [Message 2]                │     estimateSize: groupStart ? 128 : 96 (notification: 56)
│   ...                        │     overscan: 10 items
│   [Unread Indicator Line]    │
│   ...                        │
│   [Message N]                │
│                              │
│ ▼ #bottom-sentinel (1px)     │ ← IntersectionObserver triggers loadNewerMessages()
└──────────────────────────────┘
         [↓ Scroll to Bottom]
```

### Scroll position management

- **After loading older messages:** `adjustScrollPositionAfterLoad()` uses `ResizeObserver` to detect DOM changes, then adjusts `scrollTop` to maintain visual position
- **Auto-scroll on new message:** Scrolls to bottom if user is near bottom (< 100px) or sent the message
- **Initial scroll:** Scrolls to `lastReadMessageId` (centered) or bottom of messages
- **Ready gate:** `isReadyToDisplayMessages` blocks rendering until initial scroll is settled

### Page size

- **Initial load:** 20 messages
- **Pagination:** 20 messages per page
- **Root margin:** 100px trigger zone

---

## 15. Draft Persistence (IndexedDB)

### Technology

- **Database:** Dexie.js (IndexedDB wrapper)
- **Scope:** Per `workspaceId + roomId (channelId)`

### Features

| Feature                  | Value                        |
|--------------------------|------------------------------|
| Auto-save frequency      | 500ms debounce               |
| Max wait for debounce    | 2000ms                       |
| Max draft size           | 10MB (strips large attachments) |
| Max total drafts (IDB)   | 800                          |
| Draft TTL                | 120 days                     |
| Memory fallback entries   | 100                         |
| SSR safe                 | ✅ Memory fallback           |

### State persisted

```typescript
type ComposerState = {
  text: string
  html?: string
  attachments?: Array<{id, name, size?, type?, dataUrl?}>
  selection?: {start, end}
  isToolbarOpen?: boolean
  meta?: Record<string, unknown>
}
```

---

## 16. Channel Access Control

The `ChannelComposer` component implements smart access control based on channel type and user membership.

### Permission Matrix

| Channel Type | Is Member? | Is Admin/Owner? | UI Shown                   |
|--------------|------------|-----------------|----------------------------|
| THREAD       | *          | *               | `MessageComposer.Editor`   |
| DIRECT       | ✅         | *               | `MessageComposer.Editor`   |
| DIRECT       | ❌         | *               | `JoinDirectChannel`        |
| PRIVATE      | ✅         | *               | `MessageComposer.Editor`   |
| PRIVATE      | ❌         | *               | `JoinPrivateChannel`       |
| BROADCAST    | *          | ✅              | `MessageComposer.Editor`   |
| BROADCAST    | ✅         | ❌              | `JoinBroadcastChannel` (mute/unmute) |
| BROADCAST    | ❌         | ❌              | `JoinGroupChannel`         |
| GROUP/PUBLIC | ✅         | *               | `MessageComposer.Editor`   |
| GROUP/PUBLIC | ❌         | *               | `JoinGroupChannel`         |
| ARCHIVE      | *          | *               | `null` (read-only)         |
| Not signed in| —          | —               | `SignInToJoinChannel`       |

### Auto-join behavior

When `useChannelInitialData` detects the user is authenticated but not a member, it auto-joins them to the channel via `join2Channel()`.

> ✅ **v1.7.0 fix:** `userId` is now derived from `useAuthStore().profile?.id` (not `session?.id`). Anonymous/stale sessions have a UUID in `auth.users` but not in `public.users`, which caused an FK violation on `channel_members.member_id → public.users.id`. Both `addChannelMember` and `join2Channel` are now guarded behind a `userId` truthiness check — unauthenticated users skip channel join silently and see the `SignInToJoinChannel` prompt.

---

## 17. Notification System (Per-Channel)

### States

| State      | Icon          | Behavior                                  |
|------------|---------------|-------------------------------------------|
| `ALL`      | 🔔 `LuBell`  | All messages trigger notifications         |
| `MENTIONS` | @ `LuAtSign`  | Only @mentions trigger notifications       |
| `MUTED`    | 🔕 `LuBellOff`| No notifications                          |

### Toggle cycle

`ALL → MENTIONS → MUTED → ALL`

### Implementation

- `useNotificationToggle` hook fetches current state on mount, provides `handleToggle()`
- API: `getChannelNotifState()` / `updateChannelNotifState()`
- State stored in `channel_members.notif_state`

> ✅ **v1.7.0 fix:** The `NotificationPromptCard` previously showed a "Notifications enabled!" toast on every message send when push permission was already granted. Fixed by adding an early `return` when `Notification.permission === 'granted'` — the `usePushNotifications` hook already manages silent subscription on mount. Toast now only appears on explicit user action (clicking Enable on the prompt card).

---

## 18. Emoji & Reactions

### Emoji Picker

- **Desktop:** Inline popover attached to the action button
- **Mobile:** Bottom sheet via `react-modal-sheet`
- Managed by `EmojiPanel` compound component with `EmojiPanelProvider`

### Reactions on Messages

- Stored in `messages.reactions` as JSONB:
  ```json
  {
    "👍": [{"user_id": "...", "created_at": "..."}],
    "❤️": [{"user_id": "...", "created_at": "..."}]
  }
  ```
- `AddReactionButton` opens inline emoji picker
- `ReactionList` renders clickable emoji badges with count
- Clicking own reaction removes it; clicking others' adds yours

---

## 19. Threads

### Data Model

- Threads are channels of type `THREAD`
- Root message: `is_thread_root = true`
- Thread messages reference `thread_id` (FK to root message)
- `thread_depth` tracks nesting level

### Frontend State

```typescript
interface ThreadState {
  startThreadMessage: TMessage | null
  threadMessages: Map<string, Map<string, TMessage>>
}
```

### UI

- **Desktop:** Thread panel opens beside the main chat
- `ThreadHeader` with close button
- Messages sent in thread use `createThreadMessage()` RPC

---

## 20. Pinned Messages & Bookmarks

### Pinned Messages

- Stored in `pinned_messages` table
- Loaded during initial hydration (`get_channel_aggregate_data`)
- UI: `PinnedMessages` component shows a collapsible bar above message feed
- Actions: Admin/owner can pin/unpin via `usePinMessageHandler`

### Bookmarks

- Stored in `message_bookmarks` table
- **RLS enabled** — users can only manage their own bookmarks
- Bookmarked messages show a visual indicator (`BookmarkIndicator`)
- Desktop: bookmarked messages have `bg-blue-50` highlight
- Toggle via `useBookmarkMessageHandler`

---

## 21. Read Receipts & Unread Tracking

### How it works

1. **On channel open:** `get_channel_aggregate_data` returns `last_read_message_id`, `last_read_message_timestamp`, `total_messages_since_last_read`
2. **On scroll:** `useCheckReadMessage` uses the virtualizer to find the newest visible message, compares it against `lastReadTime`
3. **On new read:** Calls `markReadMessages()` API and updates `lastReadMessageTimestamp` in workspace settings store
4. **Unread indicator:** `UnreadIndicatorLine` rendered when `lastReadMessageId === message.id && totalMsgSincLastRead >= 6`
5. **Debounced:** Scroll handler runs at 120ms debounce to avoid API spam

### Visual indicators

- **Unread line:** Horizontal divider with "New messages" label
- **Date chips:** Show day separators between messages
- **Message seen indicator:** (Mobile) Shows read status on own messages

---

## 22. Design System Compliance

> ⚠️ **Note:** This section was the initial quick audit. For the comprehensive, component-by-component compliance matrix, see **§32**. Items marked ✅ Fixed below were resolved in v1.7.0.

### Current State — Audit

| Aspect                    | Status | Notes                                                    |
|---------------------------|--------|----------------------------------------------------------|
| Semantic colors           | ⚠️     | `bg-base-100/200/300` mostly used, but some hardcoded `bg-gray-*`, `bg-blue-50`, `text-gray-600`, `text-slate-800` — **Toolbar + ThreadHeader + ChatContainerMobile + SheetHeader fixed in v1.7.0** |
| Border radius tokens      | ⚠️     | Desktop toolbar now uses `rounded-selector` (v1.7.0), some `rounded-md` remain in message components |
| Touch targets             | ✅ Partial | Mobile toolbar action buttons now use `size="sm"` for 44px targets (v1.7.0); composer and reaction buttons still need work |
| Dark mode                 | ⚠️     | `Dialog.tsx` fixed in v1.7.0 (`bg-base-100`, `bg-base-content/40`); remaining violations in message components |
| Component tokens          | ⚠️     | Toolbar components now fully compliant (v1.7.0); message card area still mixed |
| Spacing consistency       | ✅     | Mostly consistent spacing via Tailwind                   |
| Accessibility (ARIA)      | ⚠️     | Toolbar buttons now have `focus-visible` ring + `aria-label` (v1.7.0); rest still inconsistent |

### Design System Violations Found

1. **`ChatContainerMobile.tsx`:** ✅ Fixed v1.7.0
   - ~~`border-gray-200`~~ → `border-base-300`
   - ~~`bg-gray-100`~~ → `bg-base-100`
   - ~~Duplicate breadcrumb~~ → removed
   - Hardcoded `chat-bubble` color logic — **still pending**

2. **`MobileLayout.tsx`:** ✅ Fixed v1.7.0
   - ~~No design system tokens, uses legacy `SheetHeader`~~ → Custom `ChatRoomHeader` with `BreadcrumbMobile` + action group

3. **`MessageCardContext.tsx`:** ❌ Still pending
   - `bg-blue-50 hover:bg-blue-100` for bookmarked — hardcoded light colors, breaks in dark mode
   - Should use `bg-info/10 hover:bg-info/20` or a semantic bookmark color

4. **`ThreadHeader.tsx`:** ✅ Fixed v1.7.0
   - ~~`text-slate-800`~~ → `text-base-content`

5. **`HoverMenuActions.tsx`:** ❌ Still pending
   - `text-gray-600` on `MdMoreVert` → should be `text-base-content/60`
   - Uses `MdMoreVert` (Material icon) instead of `Lu*` (Lucide) per design system

6. **`MobileLayout.tsx`:** ✅ Fixed v1.7.0
   - ~~`bg-transparent` on buttons~~ → Proper `Button variant="ghost"` with semantic colors

---

## 23. File Inventory

### Core Files

| Path | LOC | Purpose |
|------|-----|---------|
| `chatroom/Chatroom.tsx` | 44 | Root compound component |
| `chatroom/ChatroomContext.tsx` | 79 | Provider: channel ID, variant, dialog API |
| `chatroom/Layouts/ChatroomLayout.tsx` | 13 | Auto-selects Desktop/Mobile layout |
| `chatroom/types/chatroom.types.ts` | 61 | Core TypeScript interfaces |
| `chatroom/index.ts` | 3 | Public barrel exports |

### Components

| Path | LOC | Purpose |
|------|-----|---------|
| `Chatroom/layouts/DesktopLayout.tsx` | 47 | Desktop panel with resize handle |
| `Chatroom/layouts/MobileLayout.tsx` | 55 | Mobile sheet header + layout |
| `ChatroomToolbar/ChatroomToolbar.tsx` | 27 | Toolbar compound component |
| `ChatroomToolbar/components/Breadcrumb.tsx` | 129 | Heading path breadcrumb navigation |
| `ChatroomToolbar/components/ParticipantsList.tsx` | 38 | Online users avatar stack |
| `ChatroomToolbar/components/ShareButton.tsx` | 42 | Copy chatroom URL button |
| `ChatroomToolbar/components/NotificationToggle.tsx` | 46 | Per-channel notification toggle |
| `ChatroomToolbar/components/CloseButton.tsx` | ~20 | Close chatroom button |
| `MessageFeed/MessageFeed.tsx` | 45 | Feed container with scroll and overlays |
| `MessageFeed/MessageFeedContext.tsx` | 85 | Provider: virtualizer, infinite scroll |
| `MessageFeed/components/ScrollToBottomButton.tsx` | ~40 | Floating scroll-to-bottom button |
| `MessageFeed/components/OverLayers/` | ~80 | Loading and error overlays |
| `MessageFeed/components/PinnedMessages/` | ~60 | Pinned messages bar |
| `MessageList/MessageList.tsx` | 61 | Message list with sentinels |
| `MessageList/MessageListContext.tsx` | 99 | Provider: messages, scroll, mention |
| `MessageList/components/MessageLoop.tsx` | 121 | Virtual list renderer |
| `MessageList/components/DateChip.tsx` | ~20 | Date separator |
| `MessageList/components/UnreadIndicatorLine.tsx` | ~20 | Unread messages divider |
| `MessageList/components/SystemNotifyChip.tsx` | ~30 | System notification message |
| `MessageList/components/MessagesEmptyState.tsx` | ~30 | Empty state UI |
| `MessageList/components/MessageListContextMenu.tsx` | ~40 | Right-click context menu |
| `MessageCard/MessageCard.tsx` | 38 | Message card compound component |
| `MessageCard/MessageCardContext.tsx` | 108 | Provider: message data, card ref |
| `MessageCard/components/MessageActions/` | ~200 | Hover menu, action buttons |
| `MessageCard/components/MessageContent/` | ~150 | Body, reply ref, comment ref |
| `MessageCard/components/MessageFooter/` | ~200 | Reactions, indicators |
| `MessageCard/components/MessageHeader/` | ~150 | Avatar, username, timestamp |
| `MessageCard/components/MessageLongPressMenu/` | ~150 | Mobile long-press action sheet |
| `MessageCard/components/common/` | ~80 | DeleteConfirmation, UserReadStatus |
| `ChannelComposer/ChannelComposer.tsx` | 151 | Access control + composer routing |
| `ChannelComposer/components/` | ~200 | Join prompts (Group, Private, Direct, Broadcast, SignIn) |
| `MessageComposer/MessageComposer.tsx` | 546 | Main composer: TipTap, submit, contexts |
| `MessageComposer/hooks/useTiptapEditor.ts` | 233 | TipTap editor configuration |
| `MessageComposer/components/` | ~500 | Layouts, toolbar, context, actions, input |
| `EmojiPanel/` | ~100 | Emoji picker (Selector + Picker) |
| `threads/ThreadHeader.tsx` | 20 | Thread panel header |
| `BreadcrumbMobile.tsx` | ~40 | Mobile-specific breadcrumb |
| `CopyUrlButton.tsx` | ~30 | Copy chatroom URL button |

### Hooks

| Path | LOC | Purpose |
|------|-----|---------|
| `hooks/useChannleInitialData.ts` | 188 | Initial data fetch + channel creation |
| `hooks/useMessageSubscription.ts` | 74 | Supabase Realtime subscription |
| `hooks/useInfiniteLoadMessages.ts` | 312 | Bi-directional infinite scroll |
| `hooks/useAutoScrollForNewMessages.ts` | 121 | Auto-scroll on new messages |
| `hooks/useScrollAndLoad.ts` | 214 | Initial scroll positioning |
| `hooks/useCheckReadMessage.ts` | 141 | Read receipt tracking |
| `hooks/useHighlightMessage.ts` | ~50 | Deep-link message highlight |
| `hooks/useViewportObserver.ts` | 27 | IntersectionObserver wrapper |
| `hooks/useMentionClick.tsx` | ~30 | @mention click handler |
| `hooks/useEmojiBoxHandler.ts` | ~40 | Emoji picker state |
| `hooks/useNotificationToggle.ts` | 68 | Channel notification cycle |
| `hooks/useChatContainerResizeHandler.ts` | ~60 | Desktop resize handler |
| `hooks/listner/` | ~200 | Realtime event handlers |
| `MessageCard/hooks/` | ~400 | 13 action hooks |

### Stores

| Path | Purpose |
|------|---------|
| `stores/chat/useChatStore.ts` | Root store (merges all sub-stores) |
| `stores/chat/chatroom.ts` | Active chatroom state |
| `stores/chat/channelMessagesStore.ts` | Messages per channel (Map of Maps) |
| `stores/chat/workspaceSettingsStore.ts` | Per-channel settings |
| `stores/chat/channelMembersStore.ts` | Channel members |
| `stores/chat/channelsStore.ts` | Channel metadata |
| `stores/chat/threadStore.ts` | Thread state |
| `stores/chat/bookmark.ts` | Bookmarks |

### Database Scripts

| Path | Purpose |
|------|---------|
| `supabase/scripts/01-enum.sql` | All enum types |
| `supabase/scripts/04-channels.sql` | Channels table |
| `supabase/scripts/05-0-message.sql` | Messages table |
| `supabase/scripts/06-pinned_message.sql` | Pinned messages table |
| `supabase/scripts/06-message-bookmarks.sql` | Bookmarks table + RLS |
| `supabase/scripts/08-channel_members.sql` | Channel members table |
| `supabase/scripts/10-functions.sql` | RPC functions |
| `supabase/scripts/11-indexes.sql` | Database indexes |
| `supabase/scripts/13-RLS.sql` | Row Level Security policies |
| `supabase/scripts/15-message_counter.sql` | Message count triggers |

### API

| Path | Purpose |
|------|---------|
| `api/messages/sendMessage.ts` | Send + thread message |
| `api/messages/getAllMessages.ts` | Fetch all messages |
| `api/rpc/fetchChannelInitialData.ts` | Initial data RPC |
| `api/rpc/fetchMessagesPaginated.ts` | Paginated messages RPC |

---

## 24. Known Issues & Tech Debt

### 🔴 Critical

| ID | Issue | Location | Impact | Status |
|----|-------|----------|--------|--------|
| T1 | **Hardcoded colors break dark mode** — `bg-blue-50`, `bg-gray-100`, `text-slate-800`, `text-gray-600`, `border-gray-200` | `MessageCardContext.tsx`, `ChatContainerMobile.tsx`, `ThreadHeader.tsx`, `HoverMenuActions.tsx` | Dark mode unusable for chat | ⚠️ Partially fixed v1.7.0: `ThreadHeader`, `ChatContainerMobile`, `SheetHeader` corrected. `MessageCardContext` and `HoverMenuActions` still pending. |
| T1a | **FK violation for unauthenticated users** — `channel_members.member_id` FK violated when anonymous session UUID doesn't exist in `public.users` | `useChannleInitialData.ts` | Runtime crash on chatroom open | ✅ Fixed v1.7.0 |
| T1b | **Redundant notification toast** — "Notifications enabled!" shown on every message send | `NotificationPromptCard.tsx` | UX annoyance | ✅ Fixed v1.7.0 |
| T2 | **RLS not fully enabled** — Messages and channels tables have RLS policies commented out in `13-RLS.sql` | `supabase/scripts/13-RLS.sql` | Security concern — all authenticated users can access all messages | ❌ Open |
| T3 | **`any` types everywhere** — Heavy use of `any` in stores, hooks, and components | Throughout chatroom | Type safety, maintainability | ❌ Open |

### 🟡 Medium

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| T4 | **`useChannleInitialData` typo** in filename | `hooks/useChannleInitialData.ts` | Developer confusion |
| T5 | **Mixed icon libraries** — `MdMoreVert` (Material) in `HoverMenuActions.tsx`, should be `LuEllipsisVertical` (Lucide) | `HoverMenuActions.tsx` | Design system inconsistency |
| T6 | **Stale `@ts-ignore` comments** — Multiple `@ts-ignore` in stores and hooks | `chatroom.ts`, `channelMessagesStore.ts` | Bypassed type checking |
| T7 | **Legacy `ChannelProvider`** — Separate context provider in `context/ChannelProvider.tsx` with duplicated settings | `context/ChannelProvider.tsx` | Two parallel context systems |
| T8 | **Debounce in `useChannelInitialData`** — Using lodash debounce with `useCallback(debounce(...), [channelId])` is incorrect (creates new debounce on channelId change) | `hooks/useChannleInitialData.ts` | Potential double-fetch |
| T9 | **No error boundary** — `ChatroomContext` logs errors but doesn't render an error UI fallback | `ChatroomContext.tsx` | Silent failures |
| T10 | **DOM element access for scroll** — `messageContainerRef.current?.querySelector('.msg_card')` for cursor detection | `useInfiniteLoadMessages.ts` | Fragile, DOM-coupled |
| T11 | **`listner` typo** — Directory name `hooks/listner/` should be `hooks/listener/` | `hooks/listner/` | Developer confusion |

### 🟢 Low

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| T12 | **Missing `PubSub` cleanup** — `PubSub.publish` used in Breadcrumb without subscription cleanup | `Breadcrumb.tsx` | Memory leak potential |
| T13 | **`createFakeMessage` defined inside component** — Should be a utility function | `MessageComposer.tsx` | Readability |
| T14 | **Mobile chat container uses deprecated `ChannelProvider`** | `ChatContainerMobile.tsx` | Inconsistency with desktop |
| T15 | **Thread support incomplete on mobile** — `MobileLayout.tsx` TODO comment | `MobileLayout.tsx` | Feature gap |

---

## 25. Roadmap & Recommendations

### Phase 1 — Design System & Dark Mode (Priority: High)

> ⚠️ **Note:** For the comprehensive prioritized roadmap, see **§32.6**. This section tracks high-level progress.

- [x] Replace hardcoded colors in toolbar/header components (`ThreadHeader`, `ChatContainerMobile`, `MobileLayout`, `SheetHeader`, `Dialog.tsx`) — ✅ v1.7.0
- [x] Migrate toolbar icons to Lucide: `MdClose` → `LuX`, `MdLink` → `LuLink`, `MdContentCopy` → `LuCopy`, `MdCheck` → `LuCheck`, `RiArrowRightSLine` → `LuChevronRight` — ✅ v1.7.0
- [x] Add focus-visible states to toolbar action buttons — ✅ v1.7.0
- [ ] Replace remaining hardcoded colors in message components (`MessageCardContext`, `HoverMenuActions`, `QuickReactionMenu`, etc.)
- [ ] Replace `MdMoreVert` with `LuEllipsisVertical` in `HoverMenuActions`
- [ ] Audit all `bg-*` and `text-*` classes against `Design_System_Global_v2.md`
- [ ] Test dark mode end-to-end for chat feature

### Phase 2 — Type Safety (Priority: High)

- [ ] Replace all `any` types with proper interfaces
- [ ] Remove `@ts-ignore` comments, fix underlying type issues
- [ ] Add strict types to all store sub-modules

### Phase 3 — Security (Priority: Critical)

- [ ] Enable RLS on `messages` table
- [ ] Enable RLS on `channels` table
- [ ] Audit all RPC functions for proper `auth.uid()` checks
- [ ] Add rate limiting to message sending

### Phase 4 — Code Quality (Priority: Medium)

- [ ] Fix typos: `useChannleInitialData` → `useChannelInitialData`, `listner` → `listener`
- [ ] Consolidate `ChannelProvider` and `ChatroomContext` into single context
- [ ] Extract `createFakeMessage` to utility
- [ ] Add Error Boundary wrapper for chat feature
- [ ] Replace DOM queries in `useInfiniteLoadMessages` with virtualizer-based cursor

### Phase 5 — Mobile Feature Parity (Priority: Medium)

- [ ] Implement full thread support on mobile
- [ ] Add pin/unpin action to mobile long-press menu
- [ ] Add forward message (both platforms)
- [ ] Align mobile chat settings with desktop (currently uses legacy `ChannelProvider`)

### Phase 6 — Performance (Priority: Low-Medium)

- [ ] Profile virtualizer with 1000+ messages
- [ ] Consider message partitioning on DB level (`TODO` in `05-0-message.sql`)
- [ ] Add message search (full-text search on `content` column)
- [ ] Optimize `messageInsert` — currently queries entire channel messages for grouping

---

## 26. Backend SQL Scripts — Full Inventory & Cross-Reference

> **Reviewed:** 2026-02-12 — All 40+ SQL scripts in `packages/supabase/scripts/` audited.

### 26.1 Complete Table Inventory

| # | Table | Script | RLS | Chat-Related |
|---|-------|--------|-----|-------------|
| 1 | `public.users` | `02-users.sql` | ❌ OFF | ✅ |
| 2 | `public.admin_users` | `02-z-admin-users.sql` | ✅ ON | ❌ (admin) |
| 3 | `public.workspaces` | `03-0-workspaces.sql` | ❌ OFF | ✅ |
| 4 | `public.workspace_members` | `03-1-workspace_members.sql` | ❌ OFF | ✅ |
| 5 | `public.channels` | `04-channels.sql` | ❌ OFF | ✅ |
| 6 | `public.messages` | `05-0-message.sql` | ❌ OFF | ✅ |
| 7 | `public.pinned_messages` | `06-pinned_message.sql` | ❌ OFF | ✅ |
| 8 | `public.message_bookmarks` | `06-message-bookmarks.sql` | ✅ ON | ✅ |
| 9 | `public.notifications` | `07-notifications.sql` | ❌ OFF | ✅ |
| 10 | `public.channel_members` | `08-channel_members.sql` | ❌ OFF | ✅ |
| 11 | `public.channel_message_counts` | `15-message_counter.sql` | ❌ OFF | ✅ |
| 12 | `public.push_subscriptions` | `19-push-notifications-pgmq.sql` | ✅ ON | ✅ |
| 13 | `public.email_queue` | `20-email-notifications-pgmq.sql` | ✅ ON | ✅ |
| 14 | `public.email_bounces` | `20-email-notifications-pgmq.sql` | ✅ ON | ❌ (admin) |
| 15 | `public.document_views` | `21-document-views.sql` | ✅ ON | ❌ (analytics) |
| 16 | `public.document_view_stats` | `21-document-views.sql` | ✅ ON | ❌ (analytics) |
| 17 | `public.document_views_daily` | `21-document-views.sql` | ✅ ON | ❌ (analytics) |

> ⚠️ **Critical: Core chat tables (users, channels, messages, channel_members, notifications) have NO RLS.** See §26.7 for details.

### 26.2 Enum Types (`01-enum.sql`)

| Enum | Values | Used By |
|------|--------|---------|
| `app_permission` | `channels.delete`, `messages.delete` | — |
| `app_role` | `admin`, `moderator`, `member`, `guest` | — |
| `user_status` | `ONLINE`, `OFFLINE`, `AWAY`, `BUSY`, `INVISIBLE`, `TYPING` | `users.status` |
| `message_type` | `text`, `image`, `video`, `audio`, `link`, `giphy`, `file`, `notification` | `messages.type` |
| `channel_type` | `PUBLIC`, `PRIVATE`, `BROADCAST`, `ARCHIVE`, `DIRECT`, `GROUP`, `THREAD` | `channels.type` |
| `channel_member_role` | `MEMBER`, `ADMIN`, `MODERATOR`, `GUEST` | `channel_members.channel_member_role` |
| `notification_category` | `mention`, `message`, `reply`, `reaction`, `thread_message`, `channel_event`, `direct_message`, `invitation`, `system_alert` | `notifications.type` |
| `channel_notification_state` | `MENTIONS`, `ALL`, `MUTED` | `channel_members.notif_state` |

### 26.3 Complete Trigger Inventory

#### Messages Table Triggers

| Trigger | Event | Function | Script |
|---------|-------|----------|--------|
| `set_reply_message_preview` | BEFORE INSERT | `set_replied_message_preview()` | `10-5` |
| `track_message_replies` | BEFORE INSERT | `update_original_message_metadata()` | `10-5` |
| `set_thread_depth` | BEFORE INSERT (when `thread_id` NOT NULL) | `set_message_thread_depth()` | `10-4` |
| `increment_thread_count` | BEFORE INSERT | `increment_thread_message_count()` | `10-4` |
| `set_message_edited_at` | BEFORE UPDATE (content, html) | `update_message_edited_at()` | `10-3` |
| `update_channel_preview` | AFTER INSERT | `update_channel_preview_on_new_message()` | `10-5` |
| `trigger_on_message_insert` | AFTER INSERT | `on_message_insert_queue()` (pgmq) | `15` |
| `increment_unread_count` | AFTER INSERT | `increment_unread_count_on_new_message()` | `10-func-notif` |
| `create_mention_notifications` | AFTER INSERT (content LIKE '%@%') | `create_mention_notifications()` | `10-func-notif` |
| `create_reply_notification` | AFTER INSERT (reply_to_message_id NOT NULL) | `create_reply_notification()` | `10-func-notif` |
| `create_everyone_notifications` | AFTER INSERT (content LIKE '%@everyone%') | `create_everyone_notifications()` | `10-func-notif` |
| `create_regular_message_notifications` | AFTER INSERT | `create_regular_message_notifications()` | `10-func-notif` |
| `message_soft_delete` | AFTER UPDATE (deleted_at) | `handle_message_soft_delete()` | `10-3` |
| `update_message_previews` | AFTER UPDATE (content) | `update_message_preview_on_edit()` | `10-3` |
| `decrement_thread_count` | AFTER UPDATE (deleted_at, when thread) | `decrement_thread_message_count()` | `10-4` |
| `delete_thread_on_root_deletion` | AFTER UPDATE (deleted_at) | `delete_thread_root_and_channel()` | `10-4` |
| `create_reaction_notifications` | AFTER UPDATE (reactions) | `create_reaction_notifications()` | `10-func-notif` |
| `trigger_on_message_delete` | AFTER DELETE | `on_message_delete_queue()` (pgmq) | `15` |

#### Channels Table Triggers

| Trigger | Event | Function | Script |
|---------|-------|----------|--------|
| `channel_creator_as_admin` | AFTER INSERT | `add_channel_creator_as_admin()` | `10-2` |

#### Channel Members Table Triggers

| Trigger | Event | Function | Script |
|---------|-------|----------|--------|
| `check_duplicate_member` | BEFORE INSERT | `prevent_duplicate_channel_member()` | `10-2` |
| `increment_member_count` | AFTER INSERT | `increment_channel_member_count()` | `10-2` |
| `decrement_member_count` | AFTER DELETE | `decrement_channel_member_count()` | `10-2` |

#### Users Table Triggers

| Trigger | Event | Function | Script |
|---------|-------|----------|--------|
| `on_auth_user_created` | AFTER INSERT on `auth.users` | `handle_new_user()` | `10-1` |
| `trigger_update_user_online_at` | BEFORE UPDATE (status) | `update_user_online_at()` | `10-1` |

#### Notifications Table Triggers

| Trigger | Event | Function | Script |
|---------|-------|----------|--------|
| `broadcast_notification_changes_trigger` | AFTER INSERT/UPDATE/DELETE | `broadcast_notification_changes()` | `18` |
| `trigger_enqueue_push_notification` | AFTER INSERT | `enqueue_push_notification()` | `19` |
| `trigger_queue_email_notification` | AFTER INSERT | `queue_email_notification()` | `20` |

#### Pinned Messages Triggers

| Trigger | Event | Function | Script |
|---------|-------|----------|--------|
| `update_msg_on_pin` | AFTER INSERT | `update_message_on_pin()` | `10-7` |
| `update_msg_on_unpin` | AFTER DELETE | `update_message_on_unpin()` | `10-7` |
| `update_channel_on_pin` | AFTER INSERT/DELETE | `update_channel_activity_on_pin()` | `10-7` |

#### Workspace Members Triggers

| Trigger | Event | Function | Script |
|---------|-------|----------|--------|
| `notify_on_workspace_join` | AFTER INSERT | `notify_user_join_workspace()` | `10-8` |

### 26.4 Frontend ↔ Backend RPC Cross-Reference

| # | Backend RPC Function | Frontend File | Status |
|---|---------------------|--------------|--------|
| 1 | `get_channel_aggregate_data` | `fetchChannelInitialData.ts` | ✅ Match |
| 2 | `get_channel_messages_paginated` | `fetchMessagesPaginated.ts` | ✅ Match |
| 3 | `mark_messages_as_read` | `markReadMessages.ts` | ✅ Match |
| 4 | `create_direct_message_channel` | `creatDirectMessageChannel.ts` | ✅ Match |
| 5 | `create_thread_message` | `createThreadMessage.ts` | ✅ Match |
| 6 | `notifications_summary` | `notificationsSummary.ts` | ✅ Match |
| 7 | `get_unread_notifications_paginated` | `getUnreadNotificationsPaginated.ts` | ✅ Match |
| 8 | `fetch_mentioned_users` | `searchWorkspaceUsers.ts` | ✅ Match |
| 9 | `get_unread_notif_count` | `getUnreadNotifCount.ts` | ✅ Match |
| 10 | `get_channel_notif_state` | `getChannelNotifState.ts` | ✅ Match |
| 11 | `join_workspace` | `join2Workspace.ts` | ✅ Match |
| 12 | `get_channel_members_by_last_read_update` | `getChannelMembersByLastReadUpdate.ts` | ✅ Match |
| 13 | `toggle_message_bookmark` | `toggleMessageBookmark.ts` | ✅ Match |
| 14 | `get_user_bookmarks` | `getUserBookmarks.ts` | ✅ Match |
| 15 | `archive_bookmark` | `archiveBookmark.ts` | ✅ Match |
| 16 | `mark_bookmark_as_read` | `markBookmarkAsRead.ts` | ✅ Match |
| 17 | `get_bookmark_stats` | `getBookmarkStats.ts` | ✅ Match |
| 18 | `get_workspace_notifications` | `getLastReadedNotification.ts` | ✅ Match |
| 19 | `register_push_subscription` | `lib/push-notifications.ts` | ✅ Match |
| 20 | `unregister_push_subscription` | `lib/push-notifications.ts` | ✅ Match |

**Backend-Only Functions (no frontend RPC call needed):**

| Function | Purpose | Invoked By |
|----------|---------|------------|
| `get_bookmark_count` | Count bookmarks | ⚠️ Not called anywhere (redundant with `get_bookmark_stats`) |
| `consume_push_queue` / `ack_push_message` | Push delivery | Backend consumer (service_role) |
| `consume_email_queue` / `ack_email_message` | Email delivery | Backend consumer (service_role) |
| `process_email_queue` / `compile_digest_emails` | Email scheduling | pg_cron |
| `message_counter_batch_worker` | Message counts | pg_cron |
| `process_document_views_queue` | View analytics | pg_cron |
| `aggregate_document_view_stats` | View aggregation | pg_cron |
| All `get_*_summary`, `get_*_stats` admin functions | Admin dashboard | Backend admin API (service_role) |
| `generate_unsubscribe_token` / `process_unsubscribe` | Email unsubscribe | Backend API endpoint |
| `record_email_bounce` | Bounce handling | Webhook/backend |
| `is_admin` | Auth check | RLS policies + frontend |

### 26.5 Realtime Publication & Subscriptions

**Backend Publication (`17-database-extensions.sql`):**

```
supabase_realtime: users, channels, messages, channel_members, channel_message_counts
```

Notifications use **broadcast trigger** pattern instead of postgres_changes (more efficient O(1) routing).

**Frontend Subscription Map:**

| Subscription | Table | Filter | Hook |
|-------------|-------|--------|------|
| `channel:{channelId}` | `messages` | `channel_id=eq.{channelId}` | `useMessageSubscription` |
| `workspace:{workspaceId}` | `channel_members` | `member_id=eq.{userId}` | `useCatchUserPresences` |
| `workspace:{workspaceId}` | `channels` | `workspace_id=eq.{workspaceId}` | `useCatchUserPresences` |
| `anonymous:{workspaceId}` | `channel_message_counts` | `workspace_id=eq.{workspaceId}` | `useCatchUserPresences` |
| `notifications:{userId}` | — (broadcast) | user-specific topic | `useNotificationCount` |
| Presence | — | — | `useCatchUserPresences` |

### 26.6 pgmq Queues & Cron Jobs

**Message Queues:**

| Queue | Purpose | Producer | Consumer |
|-------|---------|----------|----------|
| `message_counter` | Channel message counts | Insert/delete triggers on messages | pg_cron (every 10s) |
| `push_notifications` | Push delivery | Insert trigger on notifications | Backend consumer (polling) |
| `email_notifications_queue` | Email delivery | pg_cron `process_email_queue` | Backend consumer (polling) |
| `document_views` | View analytics | Hocuspocus `enqueue_document_view` | pg_cron (every 10s) |

**Cron Jobs:**

| Job | Schedule | Function | Script |
|-----|----------|----------|--------|
| `update-user-status` | Every 2 min | Set OFFLINE for inactive users | `16` |
| `message_counter_batch_job` | Every 10s | `message_counter_batch_worker()` | `15` |
| `process_email_queue` | Every 2 min | `process_email_queue()` | `20` |
| `compile_digest_emails` | Every 15 min | `compile_digest_emails()` | `20` |
| `cleanup_email_queue` | Daily 3am | `cleanup_email_queue()` | `20` |
| `process_document_views_queue` | Every 10s | `process_document_views_queue()` | `21` |
| `aggregate_document_view_stats` | Every 5 min | `aggregate_document_view_stats()` | `21` |
| `create_document_views_partitions` | Monthly 1st | `create_document_views_partitions()` | `21` |
| `cleanup_old_document_views` | Weekly Sun 3am | `cleanup_old_document_views()` | `21` |

### 26.7 🔴 Critical Bugs & Issues Found

#### BUG 1: Duplicate `is_user_online` with Wrong Column Reference

**File:** `19-push-notifications-pgmq.sql` (line ~164)

The function `internal.is_user_online()` is **defined twice** — once in `10-1-func-users.sql` (correct, uses `online_at`) and once in `19-push-notifications-pgmq.sql` (incorrect, uses `last_seen_at`):

```sql
-- ❌ WRONG (19-push-notifications-pgmq.sql)
SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id
    AND status = 'ONLINE'
    AND last_seen_at > now() - interval '2 minutes'  -- ← column does NOT exist
);

-- ✅ CORRECT (10-1-func-users.sql)
SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id
    AND status = 'ONLINE'
    AND online_at > now() - interval '2 minutes'  -- ← correct column
);
```

**Impact:** Since scripts run in order (19 after 10-1), the **wrong version overwrites the correct one**. Push notifications will fail the online check — users who are online may still receive push notifications, or the query will error.

**Fix:** Change `last_seen_at` → `online_at` in `19-push-notifications-pgmq.sql`.

#### BUG 2: `create_regular_message_notifications` Trigger Condition is Always True

**File:** `10-func-notifications.sql` (line ~366)

```sql
-- ❌ WRONG: OR makes this always true (any string fails at least one condition)
WHEN (NEW.content NOT LIKE '%@%' OR NEW.content NOT LIKE '%@everyone%')

-- ✅ CORRECT: AND ensures BOTH conditions must be met
WHEN (NEW.content NOT LIKE '%@%' AND NEW.content NOT LIKE '%@everyone%')
```

**Impact:** ALL messages (including @mentions and @everyone) will **also** trigger `create_regular_message_notifications`, creating **duplicate notifications** on top of the mention/everyone-specific notifications. Users may receive 2x or 3x notifications for mentioned messages.

**Fix:** Change `OR` → `AND` in the trigger WHEN clause.

#### BUG 3: RLS Disabled on All Core Tables

**Files:** `13-RLS.sql` — entirely commented out

The following tables have **NO Row Level Security**:
- `public.users` — Any authenticated user can read/write ALL user data
- `public.channels` — Any authenticated user can modify ANY channel
- `public.messages` — Any authenticated user can read/modify ANY message
- `public.channel_members` — Any authenticated user can modify ANY membership
- `public.notifications` — Any authenticated user can read ANY notification
- `public.workspaces` / `public.workspace_members` — No access control

**Impact:** Any authenticated user with the Supabase anon key can:
- Read all messages in all channels (including PRIVATE/DIRECT)
- Delete or modify other users' messages
- Add/remove channel members
- Read other users' notifications

**Priority:** 🔴 **CRITICAL** — Must be addressed before production with real user data.

### 26.8 🟡 Warnings & Improvements

#### WARN 1: Missing Indexes for Reply/Forward Lookups

No index exists on `messages.reply_to_message_id` or `messages.origin_message_id`. Multiple triggers and RPC functions query by these columns:

```sql
-- Used in: handle_message_soft_delete, update_message_preview_on_edit, set_replied_message_preview
WHERE reply_to_message_id = OLD.id

-- Used in: update_message_preview_on_edit (forward sync)
WHERE origin_message_id = NEW.id
```

**Recommendation:** Add:
```sql
CREATE INDEX idx_messages_reply_to ON public.messages (reply_to_message_id) WHERE reply_to_message_id IS NOT NULL;
CREATE INDEX idx_messages_origin ON public.messages (origin_message_id) WHERE origin_message_id IS NOT NULL;
```

#### WARN 2: Storage Media Bucket Size Limit Too Low

`12-buckets.sql` sets the `media` bucket to **2MB max**. The `message_type` enum includes `video` and `audio` types, which typically require larger files.

**Recommendation:** Increase to at least **10MB** for the media bucket, or add a separate `video` bucket with higher limits.

#### WARN 3: `get_bookmark_count` Function Is Dead Code

The function `get_bookmark_count` exists in `07-bookmark-functions.sql` but is **never called** from the frontend. The `get_bookmark_stats` function provides a superset of this data.

**Recommendation:** Remove `get_bookmark_count` or document it as internal-only.

#### WARN 4: Disabled Channel System Notifications

The following triggers are intentionally disabled in `10-2-func-channels.sql`:
- `create_channel_notification` — No system message on channel creation
- `notify_channel_name_change` — No system message on rename
- `notify_user_join_channel` — No system message when users join
- `notify_user_leave_channel` — No system message when users leave

**Note:** These are disabled by design (per `--INFO: Disable this trigger for now` comments). Consider enabling for better channel activity visibility.

#### WARN 5: `handle_message_soft_delete` Sets `deleted_at` in AFTER UPDATE Trigger

In `10-3-func-message.sql`, the trigger fires `AFTER UPDATE OF deleted_at` but then sets `NEW.deleted_at := NOW()`. Since it's an AFTER trigger, the `NEW.deleted_at` assignment has **no effect** (the row is already written). The `deleted_at` must be set by the caller (frontend sets it via direct UPDATE).

#### WARN 6: Anonymous Users Skip Profile Creation

In `10-1-func-users.sql`, `handle_new_user()` skips anonymous users (`IF new.is_anonymous = true THEN RETURN new`). This is correct for document views but means anonymous users cannot participate in chat. Ensure the frontend enforces this.

### 26.9 Database Extensions

| Extension | Purpose | Script |
|-----------|---------|--------|
| `pg_cron` | Scheduled tasks | `14-realtime-replica.sql` |
| `pgmq` | Message queuing | `14-realtime-replica.sql` |
| `pg_net` | Async HTTP | `14-realtime-replica.sql` |

### 26.10 Storage Buckets

| Bucket | Public | Max Size | MIME Types | Policies |
|--------|--------|----------|-----------|----------|
| `user_avatars` | ✅ | 1MB | JPEG, PNG, SVG, GIF, WebP | Auth read, owner write/update/delete |
| `channel_avatars` | ✅ | 1MB | JPEG, PNG, SVG, GIF, WebP | Auth read, owner write/update/delete |
| `media` | ✅ | 2MB | All (`*/*`) | Auth read/write, owner update/delete |

### 26.11 System User

A system user is created for automated notifications:
```
ID: 992bb85e-78f8-4747-981a-fd63d9317ff1
Email: system@system.com
```
Used by: workspace join notifications, channel system messages.

---

## Closing Notes

This document provides a comprehensive map of the entire chat feature from database tables to React components. It should be used as the single source of truth for:

- **New engineers** onboarding to the chat feature
- **Sprint planning** to prioritize tech debt and new features
- **Code reviews** to verify design system compliance
- **QA** to understand what to test across desktop and mobile

**Update this document with every significant change to the chat feature.**

---

## 27. DRY / SOLID / KISS — Production Readiness Audit

> **Audit Date:** 2026-02-12
> **Scope:** Full-stack chatroom feature — frontend (React/Zustand/Tiptap) + backend (Supabase/PostgreSQL)
> **Principles:** DRY (Don't Repeat Yourself) • SOLID (Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion) • KISS (Keep It Simple, Stupid)

---

### 27.1 🔴 CRITICAL — Type Safety Crisis (`any` Epidemic)

**Principle Violated:** SOLID — Interface Segregation, Dependency Inversion

The codebase has a systemic `any` type problem that undermines TypeScript's entire value:

| Area | `any` Count | Impact |
|------|------------|--------|
| Stores (`stores/chat/`) | **35+** | All store interfaces use `any` for messages, members, channels |
| Chatroom hooks | **80+** | Listener payloads, message objects, user details all `any` |
| Chatroom components | **30+** | Props, context values, event handlers all `any` |
| `@ts-ignore` suppressions | **55+** project-wide | Hiding real type errors |

**Specific violations:**

```
// stores/chat/channelMessagesStore.ts — Map<string, any> used everywhere
messagesByChannel: Map<string, Map<string, any>>

// stores/chat/chatroom.ts — Multiple any types
headingPath: Array<any>
userPickingEmoji?: any
replyMessageMemory?: any
editeMessageMemory?: any

// hooks/listner/helpers/messageInsert.ts — Payload typed as any
export const messageInsert = async (payload: any) => { ... }

// hooks/listner/dbMessagesListener.ts — No Supabase realtime payload typing
export const dbMessagesListener = (payload: any) => { ... }
```

**Fix (Task T-01):** Create shared type definitions:

```typescript
// types/chat.types.ts
import { Database } from './database.types'

export type MessageRow = Database['public']['Tables']['messages']['Row']
export type ChannelRow = Database['public']['Tables']['channels']['Row']
export type ChannelMemberRow = Database['public']['Tables']['channel_members']['Row']
export type RealtimeMessagePayload = RealtimePostgresChangesPayload<MessageRow>

export type MessageWithUser = MessageRow & {
  user_details: UserProfile
  replied_message_details?: {
    message: MessageRow
    user: UserProfile
  }
}
```

---

### 27.2 🔴 DRY Violations — Repeated Code Patterns

#### DRY-01: Duplicate `getChannelMessages` helper (2 copies)

**Files:**
- `hooks/listner/helpers/messageInsert.ts` (line 6-9)
- `hooks/listner/helpers/messageUpdate.ts` (line 3-6)

Both define the **exact same** helper:
```typescript
const getChannelMessages = (channelId: string): any => {
  const messagesByChannel = useChatStore.getState().messagesByChannel
  return messagesByChannel.get(channelId)
}
```

**Fix (Task T-02):** Extract to `hooks/listner/helpers/shared.ts`.

#### DRY-02: Duplicate `updateChatRoom` vs `setOrUpdateChatRoom`

**File:** `stores/chat/chatroom.ts` (lines 73-78 and 94-98)

```typescript
// These two functions are IDENTICAL
updateChatRoom: (key, value) => {
  set((state) => { state.chatRoom[key] = value })
},
setOrUpdateChatRoom: (key, value) => {
  set((state) => { state.chatRoom[key] = value })
},
```

**Fix (Task T-03):** Remove `updateChatRoom`, alias to `setOrUpdateChatRoom`, or vice versa.

#### DRY-03: Identical store patterns repeated 5 times

`channelMembersStore`, `channelPinnedMessagesStore`, and parts of `channelMessagesStore` follow the **exact same** `Map<string, Map<string, any>>` pattern with identical CRUD methods:

```typescript
// Pattern repeated in channelMembersStore, channelPinnedMessagesStore:
addItem(channelId, item) → set → get/create inner Map → set item
removeItem(channelId, itemId) → set → get inner Map → delete
clearItems(channelId) → set → delete outer key
bulkSetItems(channelId, items) → set → get/create inner Map → forEach set
```

**Fix (Task T-04):** Create a generic `createChannelEntityStore<T>()` factory:

```typescript
function createChannelEntityStore<T extends { id: string }>() {
  return immer((set) => ({
    items: new Map<string, Map<string, T>>(),
    add: (channelId: string, item: T) => set(state => { ... }),
    remove: (channelId: string, itemId: string) => set(state => { ... }),
    clear: (channelId: string) => set(state => { ... }),
    bulkSet: (channelId: string, items: T[]) => set(state => { ... }),
  }))
}
```

#### DRY-04: `emojiReaction` and `removeReaction` share 90% logic

**File:** `api/messages/emojiReaction.ts`

Both functions (50 + 38 lines) do the exact same clone → find → toggle → API call pattern. The only difference: `emojiReaction` adds if missing, `removeReaction` only removes.

**Fix (Task T-05):** Merge into single `toggleReaction(message, emoji)` with toggle semantics.

#### DRY-05: `sendMessage` and `sendThreadMessage` nearly identical

**File:** `api/messages/sendMessage.ts`

```typescript
// sendMessage: insert { content, channel_id, user_id, html, reply_to_message_id }
// sendThreadMessage: insert { content, channel_id, user_id, html, thread_id }
```

Only the 5th field differs. Both `.from('messages').insert(...).select().returns<TMsgRow[]>().throwOnError()`.

**Fix (Task T-06):** Single `insertMessage(fields: Partial<MessageInsert>)` function.

#### DRY-06: Notification store and Bookmark store are clones

**Files:** `stores/notification.ts` vs `stores/chat/bookmark.ts`

Both stores have identical patterns:
- Tab-based data model (`Map<TTab, T[]>`)
- Summary stats
- `set`, `update`, `clear` methods
- `setActiveTab`, `setPage` pagination

**Fix (Task T-07):** Create `createTabBasedStore<TItem, TTab>()` generic factory.

#### DRY-07: Membership check duplicated in 5+ SQL functions

**Files:** `10-6-func-forward_msg.sql`, `10-7-func-pinned.sql` (×2), `10-4-func-threads.sql`, `10-functions.sql`

All perform:
```sql
SELECT EXISTS (
  SELECT 1 FROM public.channel_members
  WHERE channel_id = p_channel_id AND member_id = p_user_id
) INTO v_is_member;
IF NOT v_is_member THEN RAISE EXCEPTION ...
```

**Fix (Task T-08):** Create `internal.check_channel_membership(p_channel_id, p_user_id)` reusable function.

---

### 27.3 🟡 SOLID Violations

#### SOLID-01: ChatroomProvider violates SRP (Single Responsibility)

**File:** `ChatroomContext.tsx`

This single provider is responsible for:
1. Channel data fetching (`useChannelInitialData`)
2. Realtime subscription (`useMessageSubscription`)
3. Dialog state management (open/close/content)
4. Loading state coordination (`initLoadMessages`)

**Fix (Task T-09):** Split into:
- `ChatroomDataProvider` — handles data fetching & subscription
- `ChatroomDialogProvider` — handles dialog state only
- `ChatroomContext` — pure value provider (no side effects)

#### SOLID-02: MessageComposer is a 546-line God Component

**File:** `MessageComposer/MessageComposer.tsx`

This component does:
- Message submission (regular, edit, thread, comment, chunked)
- Editor lifecycle (TipTap setup, focus, content management)
- Draft persistence (IndexedDB load/save)
- Auth gating (sign-in modal)
- Toolbar state
- 18 store selectors
- 10+ `useCallback` definitions

**Fix (Task T-10):** Extract into:
- `useMessageSubmission()` — handles all send/edit/thread/comment routing
- `useDraftPersistence()` — handles IndexedDB lifecycle
- `useEditorLifecycle()` — handles TipTap setup/focus/attributes

#### SOLID-03: `useCatchUserPresences` does too many things

**File:** `hooks/useCatchUserPresences.ts`

Single hook manages:
- Anonymous subscription (message counts only)
- Authenticated subscription (channel members + channels + presence + broadcast sync)
- 4 different realtime event types
- Online/offline handling

**Fix (Task T-11):** Split into:
- `useWorkspaceRealtimeSubscription()` — Supabase channel management
- `usePresenceTracker()` — user presence sync only
- `useAnonymousSubscription()` — anonymous-only message count subscription

#### SOLID-04: `useChannelInitialData` violates OCP (Open/Closed)

**File:** `hooks/useChannleInitialData.ts`

Auto-joins channels on load AND auto-creates channels via `upsertChannel` if they don't exist. This couples channel creation to the data-loading flow:

```typescript
if (currentChannel === null && workspaceId) {
  await upsertChannel({ id: newChannelId, ... })  // ← Side effect!
}
```

**Fix (Task T-12):** Separate channel creation from data loading. Channel creation should be an explicit user action or a separate startup hook.

#### SOLID-05: `workspaceSettingsStore` violates ISP (Interface Segregation)

**File:** `stores/chat/workspaceSettingsStore.ts`

This store mixes:
- Workspace-level settings (workspaceId, broadcaster)
- Channel-level settings (per-channel Map)
- Message memory/draft state (reply, edit, forward, comment, draft)
- Typing indicators

**Fix (Task T-13):** Split into:
- `workspaceConnectionStore` — workspaceId, broadcaster, activeChannelId
- `channelSettingsStore` — per-channel settings Map
- `messageMemoryStore` — reply/edit/forward/comment/draft memory
- `typingIndicatorStore` — typing indicator Map

#### SOLID-06: `useChatStore` is a monolithic mega-store

**File:** `stores/chat/useChatStore.ts`

All 9 store slices are merged into one store:
```typescript
export const useChatStore = create<IStore>((...props) => ({
  ...workspaceSettingsStore(...props),
  ...channelMembersStore(...props),
  ...channelMessagesStore(...props),
  ...channelPinnedMessagesStore(...props),
  ...chatRoom(...props),
  ...channelsStore(...props),
  ...threadStore(...props),
  ...bookmark(...props),
  ...emojiPickerStore(...props)
}))
```

Every component subscribing to `useChatStore` re-renders when **any** slice changes. This is the #1 performance bottleneck.

**Fix (Task T-14):** Use Zustand slices with selectors properly, or separate into independent stores for truly independent data (emoji picker, bookmarks, threads are unrelated to messages).

---

### 27.4 🟡 KISS Violations

#### KISS-01: DOM data attributes used as message cursor (fragile)

**File:** `useInfiniteLoadMessages.ts` (lines 84-102)

Instead of using the message ID or timestamp from state, the code queries the DOM for `createdAt`:

```typescript
const currentTopElement = messageContainerRef.current?.querySelector(
  '.msg_card:not(:has(> .badge:first-child))'
) as HTMLElement | null

// @ts-ignore
cursorTimestamp = String(currentTopElement?.createdAt)
```

This couples pagination logic to DOM structure, CSS classes, and custom DOM properties.

**Fix (Task T-15):** Use the first/last message from the store's Map for cursor timestamps:
```typescript
const messages = Array.from(channelMessages.values())
const oldestMessage = messages[0]
const cursorTimestamp = oldestMessage?.created_at
```

#### KISS-02: Custom DOM event for editor focus (unnecessary indirection)

**Files:** Multiple hooks dispatch `document.dispatchEvent(new CustomEvent('editor:focus'))` to focus the editor.

The editor instance is already in the store (`chatRoom.editorInstance`). Dispatching a DOM event when you have direct access to the editor via state is over-engineered.

**Fix (Task T-16):** Call `editor.commands.focus()` directly from the store:
```typescript
const focusEditor = () => {
  const editor = useChatStore.getState().chatRoom.editorInstance
  editor?.commands.focus()
}
```

#### KISS-03: `createFakeMessage` for optimistic updates (fragile)

**File:** `MessageComposer.tsx` (lines 353-370)

Creates a fake message with `id: 'fake_id'` for optimistic UI, then removes it when the real message arrives. This causes:
- A `removeMessage(channelId, 'fake_id')` call on **every** new message insert
- Collisions if two messages are sent rapidly
- The fake message has no `isGroupStart` flag so rendering is inconsistent

**Fix (Task T-17):** Use UUID v4 for optimistic messages:
```typescript
const optimisticId = crypto.randomUUID()
```
Then reconcile by replacing the optimistic message with the server response.

#### KISS-04: Three separate context providers nested at chatroom level

The chatroom uses 3 nested contexts:
1. `ChatroomProvider` (ChatroomContext.tsx)
2. `ChannelProvider` (ChannelProvider.tsx)
3. `MessageComposerContext` (MessageComposerContext.ts)

Plus `ChannelProvider` is **not actually used** inside the chatroom flow — it's an older provider with overlapping settings.

**Fix (Task T-18):** Remove unused `ChannelProvider` or consolidate with `ChatroomProvider`.

#### KISS-05: Spelling errors create confusing naming

Multiple spelling errors in identifiers:
- `editeMessageMemory` → should be `editMessageMemory`
- `contextMenue` → should be `contextMenu`
- `mentionsomeone` → should be `mentionSomeone`
- `pannelHeight` → should be `panelHeight`
- `listner/` → should be `listener/`
- `useChannleInitialData` → should be `useChannelInitialData`
- `ananymousSubscription` → should be `anonymousSubscription`
- `channelMemebrs` → should be `channelMembers`
- `handelTypeingIndicator` → should be `handleTypingIndicator`

**Fix (Task T-19):** Rename all misspelled identifiers (coordinate with all files that import them).

---

### 27.5 API Layer Inconsistencies

#### API-01: Mixed error handling strategies

| File | Strategy | Return Type |
|------|----------|-------------|
| `sendMessage.ts` | `.throwOnError()` | `PostgrestResponse` |
| `deleteMessage.ts` | `.throwOnError()` | `PostgrestResponse` |
| `fetchChannelInitialData.ts` | `.then()` unwrap | `{ data, error }` |
| `fetchMessagesPaginated.ts` | `.then()` unwrap | `TMsgResponse` (no error) |
| `markReadMessages.ts` | Raw return | `PostgrestResponse` |
| `getUnreadNotifCount.ts` | Manual error check | `number` |
| `pinMessage.ts` | `getUser()` + throw | `PostgrestResponse` |
| `forwardMessage.ts` | Raw return | `PostgrestResponse` |

**Fix (Task T-20):** Standardize all API functions to use `safeSupabaseQuery()` from `error-handler.ts` — which already exists but is unused by most API functions:

```typescript
// Consistent pattern:
export const deleteMessage = (channelId: string, messageId: string) =>
  safeSupabaseQuery(
    supabaseClient.from('messages').update({...}).eq('id', messageId),
    { operation: 'deleteMessage', resource: messageId }
  )
```

#### API-02: Auth check duplicated in API functions

`pinMessage.ts` calls `supabaseClient.auth.getUser()` to get the user ID, while `emojiReaction.ts` uses `useAuthStore.getState().profile`.

**Fix (Task T-21):** Standardize: always use store profile (already loaded) or always use `auth.uid()` server-side (via RPC). Never mix.

#### API-03: `forwardMessage` bypasses the SECURITY DEFINER RPC

The backend has `forward_message()` RPC with membership validation, but the frontend directly inserts into `messages` table:

```typescript
// CURRENT (bypasses validation):
supabaseClient.from('messages').insert({ channel_id, user_id, origin_message_id })

// SHOULD USE:
supabaseClient.rpc('forward_message', { p_message_id, p_target_channel_id })
```

**Fix (Task T-22):** Use the `forward_message` RPC.

#### API-04: `pinMessage` bypasses the SECURITY DEFINER RPC

Same issue — the backend has `pin_message()` and `unpin_message()` RPCs with membership validation, but the frontend directly operates on `pinned_messages` table.

**Fix (Task T-23):** Use the `pin_message` / `unpin_message` RPCs.

---

### 27.6 Backend SQL Improvements

#### SQL-01: 40+ functions in monolithic files

**File:** `10-functions.sql` is 600+ lines with 12 functions. `10-func-notifications.sql` has 8 triggers.

**Fix (Task T-24):** Already partially done (10-1 through 10-8 files). Continue splitting remaining functions from `10-functions.sql` into domain-specific files.

#### SQL-02: No input validation on RPC functions

Functions like `get_channel_messages_paginated`, `mark_messages_as_read` don't validate input format (e.g., UUID validity, string length).

**Fix (Task T-25):** Add `CHECK` constraints or input validation at the start of each function.

#### SQL-03: Notification trigger cascading risk

A single message INSERT can trigger up to **5 separate notification triggers**:
1. `create_mention_notifications` (if `@` present)
2. `create_everyone_notifications` (if `@everyone`)
3. `create_reply_notification` (if reply)
4. `create_regular_message_notifications` (BUG: always fires due to OR vs AND)
5. `increment_unread_count`

Each notification INSERT triggers 3 more cascading triggers:
1. `broadcast_notification_changes` → realtime
2. `enqueue_push_notification` → pgmq
3. `queue_email_notification` → pgmq

**Fix (Task T-26):** Fix the OR→AND bug (reported in §26.7 BUG 2), then audit the cascade chain to ensure no duplicate processing.

---

## 28. Production Readiness Roadmap

### Phase 1: Security & Critical Bugs (Week 1) 🔴

| Task ID | Description | Priority | Effort |
|---------|-------------|----------|--------|
| **S-01** | Enable RLS on all core tables (§26.7 BUG 3) | 🔴 Critical | 3d |
| **S-02** | Fix `is_user_online` column reference (§26.7 BUG 1) | 🔴 Critical | 1h |
| **S-03** | Fix notification trigger OR→AND bug (§26.7 BUG 2) | 🔴 Critical | 1h |
| **S-04** | Use RPC for forward_message (API-03, Task T-22) | 🔴 High | 2h |
| **S-05** | Use RPC for pin_message (API-04, Task T-23) | 🔴 High | 2h |

### Phase 2: Type Safety Foundation (Week 2) 🟠

| Task ID | Description | Priority | Effort |
|---------|-------------|----------|--------|
| **T-01** | Create shared chat type definitions | 🟠 High | 1d |
| **T-20** | Standardize API error handling | 🟠 High | 1d |
| **T-21** | Standardize auth pattern in API layer | 🟠 Medium | 4h |
| **T-19** | Fix all spelling errors in identifiers | 🟠 Medium | 4h |
| **T-25** | Add input validation to SQL RPCs | 🟠 Medium | 1d |

### Phase 3: DRY Refactoring (Weeks 3-4) 🟡

| Task ID | Description | Priority | Effort |
|---------|-------------|----------|--------|
| **T-02** | Extract shared `getChannelMessages` helper | 🟡 Medium | 1h |
| **T-03** | Remove duplicate `updateChatRoom`/`setOrUpdateChatRoom` | 🟡 Medium | 1h |
| **T-04** | Create generic `createChannelEntityStore<T>` factory | 🟡 Medium | 4h |
| **T-05** | Merge `emojiReaction`/`removeReaction` | 🟡 Medium | 2h |
| **T-06** | Merge `sendMessage`/`sendThreadMessage` | 🟡 Medium | 2h |
| **T-07** | Create generic tab-based store factory | 🟡 Low | 4h |
| **T-08** | Extract SQL membership check to reusable function | 🟡 Low | 2h |
| **T-24** | Continue splitting `10-functions.sql` | 🟡 Low | 2h |

### Phase 4: SOLID Architecture (Weeks 5-6) 🔵

| Task ID | Description | Priority | Effort |
|---------|-------------|----------|--------|
| **T-09** | Split ChatroomProvider (SRP) | 🔵 Medium | 4h |
| **T-10** | Decompose MessageComposer God Component | 🔵 High | 1d |
| **T-11** | Split `useCatchUserPresences` | 🔵 Medium | 4h |
| **T-12** | Separate channel creation from data loading | 🔵 Medium | 2h |
| **T-13** | Split `workspaceSettingsStore` | 🔵 Medium | 4h |
| **T-14** | Optimize Zustand store re-renders | 🔵 High | 1d |
| **T-26** | Audit notification cascade chain | 🔵 Medium | 4h |

### Phase 5: KISS Simplification (Week 7) ⚪

| Task ID | Description | Priority | Effort |
|---------|-------------|----------|--------|
| **T-15** | Replace DOM-based cursor with state-based | ⚪ Medium | 2h |
| **T-16** | Remove custom DOM events for editor focus | ⚪ Low | 1h |
| **T-17** | Use UUID for optimistic messages | ⚪ Medium | 2h |
| **T-18** | Remove/consolidate unused ChannelProvider | ⚪ Low | 1h |

### Phase 6: Missing Indexes & Performance (Week 8) 📊

| Task ID | Description | Priority | Effort |
|---------|-------------|----------|--------|
| **P-01** | Add index on `messages.reply_to_message_id` (§26.8 WARN 1) | 📊 Medium | 1h |
| **P-02** | Add index on `messages.origin_message_id` (§26.8 WARN 1) | 📊 Medium | 1h |
| **P-03** | Increase media bucket size limit (§26.8 WARN 2) | 📊 Low | 30m |
| **P-04** | Remove dead `get_bookmark_count` function (§26.8 WARN 3) | 📊 Low | 30m |

---

## 29. Metrics & Definition of Done

### Production-Ready Checklist

| # | Criterion | Current | Target |
|---|-----------|---------|--------|
| 1 | `any` types in chat code | 150+ | **0** |
| 2 | `@ts-ignore` in chat code | 55+ | **0** |
| 3 | RLS on core tables | 2/10 | **10/10** |
| 4 | API functions using standardized error handler | 2/20 | **20/20** |
| 5 | Duplicate code patterns | 7 major | **0** |
| 6 | Spelling errors in identifiers | 9+ | **0** |
| 7 | God components (>300 lines) | 2 | **0** |
| 8 | Store slices with `any` | 6/9 | **0/9** |
| 9 | SQL functions with membership check | 5 (inline) | **5 (shared)** |
| 10 | Critical security bugs | 3 | **0** |

### Industry-Standard Benchmarks

- **TypeScript strict mode** compliance (no `any`, no `@ts-ignore`)
- **OWASP** RLS coverage on all user-facing tables
- **SRP:** No component or hook over 200 lines
- **DRY:** Zero duplicate utility functions
- **Error handling:** Single standardized pattern across all API calls
- **Naming:** All identifiers spell-checked and consistent casing

---

## 30. Staff Engineering Trade-Off Analysis

> **Panel Date:** 2026-02-12
> **Panel Composition:** Staff Engineers — Frontend Architecture, Backend/Infrastructure, Real-time Systems, Security, DX/Developer Experience
> **Scope:** Every material architectural decision in the chatroom feature, evaluated for trade-offs, risks, and alternatives

---

### 30.1 State Management: Zustand Single Mega-Store

**Decision:** All chat state (9 slices) merged into one `useChatStore`.

| Dimension | Assessment |
|-----------|------------|
| **What we gained** | Single import (`useChatStore`); any component can read any slice; zero prop-drilling; slices share a common `set`/`get` so cross-slice mutations are trivial |
| **What we gave up** | Granular re-render isolation — every selector touches the same store reference, so a bookmark update can trigger re-renders in the message list if selectors aren't surgical; cognitive load to trace which slice owns what; testing a single slice requires mocking the entire store |
| **Risk** | At 500+ messages with frequent reactions/typing indicators, the emoji-picker and typing-indicator updates can cascade into the virtualizer re-layout cycle. This is the **#1 latent performance cliff** |
| **Alternative considered** | Separate independent Zustand stores per domain (messages, members, bookmarks, emoji). Each store re-renders only its consumers |
| **Verdict** | **Acceptable for MVP, but needs migration before 10K DAU.** Add `useShallow` selectors immediately as a stopgap. Plan store separation in Phase 4 (§28) |

---

### 30.2 Realtime Architecture: `postgres_changes` for Messages vs. Broadcast for Notifications

**Decision:** Messages use Supabase `postgres_changes` (CDC over WAL). Notifications use `realtime.send()` broadcast from a trigger.

| Dimension | Messages (`postgres_changes`) | Notifications (Broadcast) |
|-----------|-------------------------------|---------------------------|
| **Latency** | ~50-200ms (WAL → Realtime → client) | ~30-100ms (trigger → Realtime → client) |
| **Filtering** | Server-side filter `channel_id=eq.{id}` | Client listens on `notifications:{userId}` topic |
| **Payload** | Full row (all columns sent over the wire) | Custom minimal JSON payload |
| **Scale ceiling** | Each `postgres_changes` subscription opens a WAL slot; at ~50 concurrent channels this strains replication | O(1) per user — scales linearly with user count |
| **Security** | Relies on RLS to filter rows (**which is disabled** — critical) | Topic is public but scoped to user ID |

**Trade-off Assessment:**

The **hybrid approach is architecturally sound** — `postgres_changes` is appropriate for the primary message feed where you need the full row, and broadcast is efficient for the notification counter. However:

- ⚠️ `postgres_changes` sends the **full row** including `html` (which can be large). At scale, this wastes bandwidth. Consider switching to broadcast-from-trigger for messages too, sending only `{ id, channel_id, user_id, created_at }`, and fetching the full message on the client.
- 🔴 With RLS disabled, `postgres_changes` has **no server-side filtering** beyond the channel_id filter param. Any authenticated user can theoretically sniff messages from any channel if they subscribe to the right filter. This must be fixed.
- ⚠️ The `channel_members` subscription in `useCatchUserPresences` listens on `member_id=eq.{userId}` — good for the current user's memberships. But channel-level events (new member joins) aren't broadcast to other channel members, so the participant list can become stale.

**Recommendation:**
1. Keep hybrid architecture
2. Enable RLS (Phase 1) — this is a prerequisite for `postgres_changes` security
3. Plan migration of message realtime to broadcast-from-trigger at scale (>5K concurrent channels)

---

### 30.3 Virtualization: `@tanstack/react-virtual` for Message Rendering

**Decision:** Messages are rendered via `useVirtualizer` with dynamic row heights and `measureElement`.

| Dimension | Assessment |
|-----------|------------|
| **What we gained** | Handles 10K+ messages without DOM explosion; smooth scroll; only ~20 DOM nodes at any time; proven library with active maintenance |
| **What we gave up** | Absolute positioning (`transform: translateY`) means CSS-based animations on message cards are awkward; dynamic measurement via `measureElement` causes layout thrashing on fast scroll; the virtualizer must be passed through 3 context layers (Feed → List → Loop) |
| **Risk** | `estimateSize` uses a heuristic (`isGroupStart ? 128 : 96`) — if actual rendered height diverges significantly, the virtualizer will miscalculate total height, causing scroll jumps. Rich content (images, code blocks, embeds) will reliably diverge from these estimates |
| **Alternative considered** | `react-window` (fixed-size only, rejected for variable messages), `react-virtuoso` (auto-measures but heavier), native CSS `content-visibility: auto` (no React integration), or no virtualization with pagination-only (bad UX for chat) |
| **Verdict** | **Correct choice.** Tanstack Virtual is the right tool. But the `estimateSize` heuristic needs to be smarter — measure the first N messages on mount and derive an average, or cache measurements per message ID |

**Critical Sub-Trade-off — Scroll Position Restoration:**

The scroll-to-last-read-message flow (`useScrollAndLoad`) uses a `waitForScrollSettled` function that polls via `requestAnimationFrame` for 5 stable frames OR times out at 700ms. This is defensive but:
- On slow devices (mobile), 700ms may not be enough if the virtualizer is still measuring
- On fast devices, it always waits for at least 5 frames (~83ms) even if settled instantly
- The `scheduleScroll` with `setTimeout(500ms)` for last-read and `setTimeout(100ms)` for bottom is a magic-number-based timing assumption

**Better approach:** Use `virtualizer.scrollToIndex` with an `onChange` callback to detect when the virtualizer reports the scroll is complete, eliminating the polling loop entirely.

---

### 30.4 Message Pagination: Bidirectional Cursor-Based with Intersection Observer

**Decision:** Older and newer messages load via `IntersectionObserver` on sentinel `<div>` elements, using server-side timestamp cursors.

| Dimension | Assessment |
|-----------|------------|
| **What we gained** | Truly infinite scroll in both directions; no manual "Load More" button; cursor-based pagination is DB-efficient (uses indexed `created_at`); intersection detection is performant |
| **What we gave up** | Bidirectional complexity — 5 boolean states (`isLoadingMore`, `isLoadingNewer`, `hasMoreOlder`, `hasMoreRecent`, `loadingMoreDirection`) create a mini state machine that's hard to reason about; loading older messages requires scroll-position adjustment after DOM mutation |
| **Risk** | The `adjustScrollPositionAfterLoad` uses a `ResizeObserver` with a 500ms fallback timeout — if the observer fires before the virtualizer finishes its layout pass, the scroll position correction will be wrong. Race condition between virtualizer re-layout and ResizeObserver |
| **Alternative considered** | Offset-based pagination (simpler but breaks when messages are inserted/deleted between pages), keyset/cursor with `id` instead of `timestamp` (avoids duplicate-timestamp edge cases) |
| **Verdict** | **Correct architecture, but the DOM-based cursor extraction is wrong** (§27.4 KISS-01). The cursor should come from the message Map in store, not from DOM attributes. Also, consider switching to the virtualizer's built-in `scrollToIndex` for position restoration instead of manual scroll math |

---

### 30.5 Optimistic Updates: Fake Message Insert Pattern

**Decision:** On send, a fake message with `id: 'fake_id'` is injected into the store, then removed when the real message arrives via realtime.

| Dimension | Assessment |
|-----------|------------|
| **What we gained** | Instant UI feedback — the user sees their message immediately; simple implementation (3 lines to insert, 1 line to remove) |
| **What we gave up** | Only one in-flight message at a time (all share `fake_id`); the fake message has no `isGroupStart` so the message grouping logic may render it incorrectly; `removeMessage(channelId, 'fake_id')` runs on **every** incoming message INSERT, including messages from other users — wasted operation |
| **Risk** | **Race condition:** If two messages are sent rapidly, the second `fake_id` overwrites the first before the first real message arrives. The user sees the second message content twice. This is a **real bug at production typing speeds** |
| **Alternative A** | Use `crypto.randomUUID()` for optimistic IDs, then reconcile by matching on `content + user_id + timestamp ± 5s` when the real message arrives |
| **Alternative B** | Use the Supabase `.insert().select()` response (which returns the real row) to replace the optimistic message. No realtime reconciliation needed — the optimistic message gets replaced by the API response, and the realtime INSERT is deduplicated by ID |
| **Verdict** | **Needs redesign before production.** Alternative B is recommended — it's simpler and eliminates the reconciliation problem entirely |

---

### 30.6 Draft Persistence: IndexedDB via Dexie with In-Memory Fallback

**Decision:** Message drafts are persisted to IndexedDB per workspace+room, with debounced writes (500ms) and an in-memory Map fallback for private browsing/SSR.

| Dimension | Assessment |
|-----------|------------|
| **What we gained** | Drafts survive page refresh, tab close, and browser restart; scoped per workspace+room so no collisions; 120-day TTL prevents unbounded growth; 800-draft max prevents quota exhaustion; debounced writes avoid IDB write storm |
| **What we gave up** | Complexity — the Dexie singleton, fallback map, LRU pruning, stale cleanup, and debounced writer cache are 400 lines of code for what could be `localStorage.setItem`; Dexie adds ~40KB to the bundle; the fallback Map is not persisted so private-browsing users lose drafts on close |
| **Risk** | Low. The implementation is production-grade. The main risk is that toolbar state (`isToolbarOpen`) is persisted in the same draft object, causing a Dexie write on every toolbar toggle even if the text hasn't changed |
| **Alternative considered** | `localStorage` (synchronous, blocks main thread, 5MB limit), `sessionStorage` (lost on tab close), Supabase table (network latency on every keystroke), or Zustand `persist` middleware (no per-room isolation) |
| **Verdict** | **Excellent decision.** This is one of the best-engineered parts of the codebase. Minor improvement: separate toolbar state from draft text to avoid unnecessary IDB writes |

---

### 30.7 Compound Component Pattern: `ChatRoom.Toolbar`, `MessageCard.Header`, etc.

**Decision:** Major components expose sub-components as static properties (e.g., `ChatRoom.MessageFeed`, `MessageCard.Actions`).

| Dimension | Assessment |
|-----------|------------|
| **What we gained** | Extreme composability — layouts can mix and match sub-components freely; desktop and mobile can use completely different assemblies from the same primitives; clear ownership (sub-component is always used with its parent); good discoverability via autocomplete |
| **What we gave up** | TypeScript can't enforce composition rules (nothing prevents using `MessageCard.Footer` outside a `MessageCard`); the pattern relies on context for data flow, so deep nesting creates long context chains (Chatroom → Feed → List → Loop → Card → Header); static properties break tree-shaking |
| **Risk** | Context chain depth is currently 5 levels: `ChatroomProvider → MessageFeedProvider → MessageListProvider → MessageCardProvider → MessageComposerContext`. Each level adds a React render boundary and context subscription. At 100+ visible messages, this means 500+ context subscriptions |
| **Alternative considered** | Flat prop-passing (rejected — too much drilling for this depth), render props (less ergonomic), Radix-style slot-based composition (more complex but type-safe) |
| **Verdict** | **Correct pattern for this use case.** The Headless UI / Radix model proves this scales well. The 5-level context depth is acceptable if each context is lean (minimal values). The real concern is that `MessageListContext` and `MessageFeedContext` have overlapping values (`isLoadingMore`, `loadingMoreDirection`, `messageContainerRef` all passed through both) |

---

### 30.8 Notification System: pgmq Queue Architecture

**Decision:** Push notifications and email notifications use PostgreSQL Message Queue (`pgmq`) instead of `pg_net` HTTP calls from triggers.

| Dimension | Push (pgmq) | Email (pgmq) | Old approach (pg_net) |
|-----------|-------------|---------------|----------------------|
| **Reliability** | ✅ Messages persist in queue until consumed | ✅ Same | ❌ Fire-and-forget HTTP; if backend is down, notification is lost |
| **Security** | ✅ No exposed HTTP endpoint | ✅ Same | ❌ Requires public endpoint that could be abused |
| **Latency** | ~2-5s (polling interval) | ~30s-5min (digest batching) | ~200ms (direct HTTP) |
| **Cost** | $0 (uses existing Postgres) | $0 | $0 but pg_net has connection limits |
| **Complexity** | Medium — requires backend consumer process | Medium | Low — trigger directly calls API |

**Trade-off Assessment:**

The pgmq migration is a **clear improvement** for production. The 2-5s push notification delay is imperceptible to end users (they're not staring at the notification bell). Key considerations:

- ✅ The cascade chain (message INSERT → notification trigger → pgmq enqueue) keeps the message INSERT transaction lightweight (enqueue is O(1))
- ⚠️ The `enqueue_push_notification` trigger runs **7 queries** before deciding to enqueue: `is_push_enabled`, `is_user_online`, `is_quiet_hours`, `get_push_preferences`, subscription check, sender info, then enqueue. On a channel with 100 members, this means 700 queries per message. This should be batched
- ⚠️ The `is_user_online` function has the `last_seen_at` bug (§26.7 BUG 1), meaning push notifications may fire even when users are online
- ✅ The email queue table with status tracking (`pending → processing → sent → failed`) is a proper outbox pattern — production-grade

**Recommendation:** The pgmq pattern is correct. Fix `is_user_online`. For channels with >50 members, consider batching the "should I notify this user?" check into a single query that returns the list of users to notify.

---

### 30.9 Message Counter: pgmq Batch Worker vs. Real-time COUNT(*)

**Decision:** Message counts are maintained via a pgmq queue with a cron-based batch worker (every 10 seconds), rather than `COUNT(*)` queries or trigger-based `UPDATE`.

| Dimension | pgmq Batch Worker | Trigger-based INCREMENT | COUNT(*) on read |
|-----------|-------------------|------------------------|------------------|
| **Write contention** | ✅ None on INSERT path (only enqueue) | ❌ Row-level lock on channel_message_counts per INSERT | ✅ None |
| **Read accuracy** | ⚠️ Up to 10s stale | ✅ Always accurate | ✅ Always accurate |
| **Read performance** | ✅ O(1) lookup | ✅ O(1) lookup | ❌ O(n) per channel — table scan |
| **Hot-path latency** | ✅ Enqueue is O(1) | ❌ UPDATE is expensive under concurrency | ✅ No write needed |
| **Complexity** | Medium (queue + worker + cron) | Low | Low |

**Trade-off Assessment:**

This is a **sophisticated, correct decision** for a chat application where:
- Message counts change frequently (high write rate)
- Count accuracy within 10 seconds is acceptable for UI display
- The hot path (message INSERT) must stay fast

The 10-second cron interval means the UI shows "142 messages" even when it's really 147. For a chat app, this is fine — users don't count messages.

**Risk:** The cron job runs `message_counter_batch_worker()` with `max_loops = 10` and `read_limit = 100`, processing up to 1,000 events per run. If a channel receives more than 1,000 messages in 10 seconds (possible during a major event or bot spam), the queue will grow unboundedly.

**Recommendation:** Add a queue-depth monitoring alert. If `pgmq.metrics('message_counter')` shows depth > 5,000, trigger an alert.

---

### 30.10 Reactions: JSON Column vs. Junction Table

**Decision:** Emoji reactions are stored as a JSONB column on the `messages` table: `{ "👍": [{ user_id, created_at }], "🎉": [...] }`.

| Dimension | JSONB Column (current) | Junction Table (`message_reactions`) |
|-----------|------------------------|--------------------------------------|
| **Read performance** | ✅ Single row read — reactions come with the message | ❌ Requires JOIN or sub-query |
| **Write performance** | ❌ Full JSON read-modify-write on every reaction toggle | ✅ Simple INSERT/DELETE |
| **Concurrency** | ❌ If two users react simultaneously, last write wins (lost update) | ✅ No conflicts — separate rows |
| **Indexing** | ❌ Can't index "who reacted with what" efficiently | ✅ Standard B-tree indexes |
| **RLS** | ❌ Can't apply row-level policy per reaction | ✅ Full RLS per reaction row |
| **Realtime** | ❌ Entire message row re-sent on every reaction (including full `html`) | ✅ Only the reaction row changes |

**Trade-off Assessment:**

The JSONB approach was a reasonable **speed-to-ship decision** but has real production issues:

- 🔴 **Lost update bug:** The `emojiReaction()` function (frontend) reads the message, modifies the JSON in JavaScript, then writes it back. If User A and User B react at the same time, one reaction is lost. This is not theoretical — it **will** happen in active channels.
- ⚠️ **Bandwidth waste:** Every reaction toggle sends the entire message row over realtime, including the `html` field. In a message with 20 reactions and a long HTML body, this could be 10KB+ per reaction event.
- ⚠️ **Frontend logic owns data integrity:** The toggle logic lives in `api/messages/emojiReaction.ts` on the client side. If a user has a stale message object, they can overwrite other users' reactions.

**Recommendation:** Migrate to a junction table before public launch. This is a **high-priority trade-off debt** that will cause user-visible bugs under concurrent usage. Short-term mitigation: move the toggle logic to a SECURITY DEFINER RPC function that uses `jsonb_set()` atomically.

---

### 30.11 Channel Creation: Implicit vs. Explicit

**Decision:** `useChannelInitialData` auto-creates channels via `upsertChannel` if they don't exist.

| Dimension | Assessment |
|-----------|------------|
| **What we gained** | Zero-friction UX — opening a heading chat for the first time "just works" without a creation step; integrates with document heading navigation seamlessly |
| **What we gave up** | Data loading and data creation are coupled in the same hook; unauthenticated users trigger channel creation with a system user ID (`Config.chat.systemUserId`); channels can be created with slugified heading IDs as names, which may not be human-readable |
| **Risk** | A malicious or buggy client could create thousands of channels by navigating rapidly through headings. There's no rate limit on channel creation. Combined with disabled RLS, this is a **DoS vector** |
| **Verdict** | **Acceptable for document-native chat** (each heading maps 1:1 to a channel). But separate the creation into a dedicated `useChannelCreation` hook and add server-side rate limiting. The system user fallback for unauthenticated users should be reconsidered — ghost channels are hard to audit |

---

### 30.12 Security Trade-Off: SECURITY DEFINER Functions vs. Direct Table Access

**Decision:** Some operations use SECURITY DEFINER RPCs (forward, pin, mark-read, bookmark), while others bypass them and hit tables directly.

| Operation | Current Path | Correct Path | Security Gap |
|-----------|-------------|-------------|-------------|
| Send message | `INSERT INTO messages` | Direct (OK if RLS is ON) | 🔴 RLS is OFF |
| Delete message | `UPDATE messages SET deleted_at` | Direct (OK if RLS is ON) | 🔴 RLS is OFF |
| Edit message | `UPDATE messages SET content` | Direct (OK if RLS is ON) | 🔴 RLS is OFF — any user can edit any message |
| Forward message | `INSERT INTO messages` | Should use `forward_message()` RPC | 🔴 Bypasses membership check |
| Pin message | `INSERT INTO pinned_messages` | Should use `pin_message()` RPC | 🔴 Bypasses membership check |
| React to message | `UPDATE messages SET reactions` (JSON) | Should use RPC | 🔴 No ownership validation |
| Mark as read | `mark_messages_as_read()` RPC | ✅ Correct | ✅ OK |
| Bookmark | `toggle_message_bookmark()` RPC | ✅ Correct | ✅ OK |
| Get messages | `get_channel_messages_paginated()` RPC | ✅ Correct | ✅ OK |

**Trade-off Assessment:**

The "direct table access for common operations, RPC for complex operations" split is a reasonable development-speed decision — but **only if RLS is enforced.** With RLS disabled:

- Any authenticated user can read all messages in all channels
- Any authenticated user can edit or delete any message
- Any authenticated user can forward to channels they're not a member of
- Any authenticated user can modify reactions on any message

**This is the single highest-risk trade-off in the entire system.**

**Recommendation:** There are two valid paths:
1. **RLS-first (recommended):** Enable RLS on all tables, write proper policies, and keep direct table access for simple CRUD. This is the Supabase-native approach.
2. **RPC-only:** Route all writes through SECURITY DEFINER RPCs that validate permissions. This gives more control but adds more SQL to maintain.

Choose one. Don't mix. The current mixed approach with RLS disabled gives the worst of both worlds.

---

### 30.13 Frontend Error Handling: Fire-and-Forget vs. Standardized

**Decision:** API calls use a mix of `.throwOnError()`, manual `if (error)` checks, `.catch(console.error)`, and sometimes no error handling at all.

| Pattern | Usage Count | Risk |
|---------|-------------|------|
| `.throwOnError()` + try/catch in caller | ~8 API functions | ✅ Errors bubble up correctly |
| `.throwOnError()` with no caller catch | ~4 API functions | ⚠️ Unhandled promise rejection |
| Manual `if (error)` check | ~5 API functions | ⚠️ Inconsistent error shape |
| No error handling | ~3 API functions (`forwardMessage`, `markReadMessages`) | 🔴 Silent failures |
| `useApi` hook wrapper | Used in MessageComposer | ⚠️ Swallows errors into `useState` |

**Trade-off Assessment:**

The `safeSupabaseQuery()` utility and `ApiError` class in `api/utils/error-handler.ts` are **well-designed but barely used**. The team invested in building a proper error handling framework but didn't enforce its adoption across the codebase.

The `useApi` hook has a design flaw: it stores errors in `useState` but also re-throws them. Callers can't reliably know if the error was handled (shown to user) or needs additional handling.

**Recommendation:**
1. All API functions should use `safeSupabaseQuery()` — no exceptions
2. Remove the raw `.throwOnError()` pattern from API functions (let `safeSupabaseQuery` handle it)
3. The `useApi` hook should be the **only** way components call API functions — enforce via lint rule

---

### 30.14 Context Provider Depth: 5-Level Nesting

**Decision:** The chatroom renders through 5 nested React Context providers.

```
ChatroomProvider
  └── MessageFeedProvider
        └── MessageListProvider
              └── MessageCardProvider (× N messages)
                    └── MessageComposerContext (separate subtree)
```

| Dimension | Assessment |
|-----------|------------|
| **What we gained** | Clean separation of concerns at each level; each provider handles one domain; components at any level can access their parent's context |
| **What we gave up** | Provider depth means context value changes trigger re-renders in all children. `MessageFeedProvider` passes `isLoadingMore` through to `MessageListProvider` which passes it to components — classic prop-drilling-via-context |
| **Risk** | `MessageListProvider` re-creates `messagesArray` on every `messages` Map change (via `useMemo`). Since the Map is stored in Zustand with immer, every `setOrUpdateMessage` creates a new Map reference, causing `messagesArray` to re-compute and all virtualized items to re-render |
| **What's overlapping** | `MessageFeedContext` and `MessageListContext` share 4 identical values: `isLoadingMore`, `loadingMoreDirection`, `messageContainerRef`, `virtualizerRef`. These are just passed through. `ChannelProvider` (from `context/ChannelProvider.tsx`) provides `channelId` and `settings`, but `ChatroomProvider` also provides `channelId`. The two providers are **not connected** — `ChannelProvider` is a dead/unused code path |

**Recommendation:**
1. Merge `MessageFeedContext` and `MessageListContext` into a single `MessageStreamContext`
2. Remove `ChannelProvider` (unused, conflicts with `ChatroomProvider`)
3. Ensure `MessageCardProvider` does not subscribe to any store — it should only receive props from its parent via the render callback

---

### 30.15 Trade-Off Summary Matrix

| # | Decision | Velocity Gain | Technical Debt | Risk Level | Fix Priority |
|---|----------|--------------|----------------|------------|-------------|
| 1 | Single mega-store | High | Medium | 🟡 Perf cliff | Phase 4 |
| 2 | Hybrid realtime | Medium | Low | 🔴 Security (RLS) | Phase 1 |
| 3 | Tanstack Virtual | High | Low | 🟢 Low | — |
| 4 | Bidirectional pagination | High | Medium | 🟡 DOM coupling | Phase 5 |
| 5 | Fake message optimistic | High | High | 🔴 Race condition | Phase 3 |
| 6 | IndexedDB drafts | Low | None | 🟢 Solid | — |
| 7 | Compound components | High | Low | 🟢 Low | — |
| 8 | pgmq notifications | Medium | Low | 🟡 7-query cascade | Phase 4 |
| 9 | pgmq message counter | Medium | Low | 🟢 Low | — |
| 10 | JSONB reactions | High | **Very High** | 🔴 Lost updates | Phase 2 |
| 11 | Implicit channel creation | High | Medium | 🟡 DoS vector | Phase 3 |
| 12 | Mixed security model | High | **Critical** | 🔴 Auth bypass | Phase 1 |
| 13 | Mixed error handling | Medium | High | 🟡 Silent failures | Phase 2 |
| 14 | 5-level context nesting | Medium | Medium | 🟡 Perf/overlap | Phase 4 |

### 30.16 Key Takeaways for the Engineering Team

**What the team got right:**
- ✅ Compound component pattern — industry standard, highly composable
- ✅ IndexedDB draft persistence — production-grade with fallbacks and cleanup
- ✅ pgmq for async processing — correct architectural choice, well-documented
- ✅ Tanstack Virtual for message rendering — correct tool for the job
- ✅ Bidirectional cursor pagination — correct algorithm for infinite chat scroll
- ✅ Notification broadcast from trigger — O(1) routing, efficient at scale
- ✅ Offline detection and subscription cleanup — shows production thinking
- ✅ Message counter batching — avoids write contention on hot path

**What must be fixed before production:**
1. 🔴 **Enable RLS** — the entire security model depends on it
2. 🔴 **Fix JSONB reactions** — will cause user-visible data loss under concurrency
3. 🔴 **Fix optimistic updates** — `fake_id` race condition is a guaranteed bug
4. 🔴 **Route all writes through RPC or enforce RLS** — mixed model is unsafe
5. 🟠 **Standardize error handling** — silent failures mask real issues in production

**What can wait for scale:**
- Store separation (needed at >5K DAU)
- Broadcast-from-trigger for messages (needed at >50 concurrent channels)
- Reaction junction table (blocks on JSONB migration, needed at >100 concurrent users)
- Context merging (nice-to-have for DX, not user-facing)

---

## 31. Compound Component Pattern — Deep Architecture Audit

> **Panel Date:** 2026-02-12
> **Led by:** Head of Frontend Engineering + Head of Engineering
> **Scope:** Is the compound component pattern correctly applied? Over-engineered? What should an industry-standard implementation look like?

---

### 31.1 Current Architecture Map

Below is the **complete component tree** with every static sub-component export and every React Context provider in the chatroom feature.

```
Chatroom (root)                              ← ChatroomProvider context
├── .Toolbar = ChatroomToolbar               ← No context (pure layout)
│   ├── .Breadcrumb
│   ├── .ParticipantsList
│   ├── .ShareButton
│   ├── .NotificationToggle
│   └── .CloseButton
├── .Layout = ChatroomLayout                 ← No context (variant switch)
│   ├── .DesktopLayout
│   └── .MobileLayout
├── .ChannelComposer = ChannelComposer       ← No context (access control logic)
│   ├── .SignInPrompt
│   ├── .JoinPrivate
│   ├── .JoinDirect
│   ├── .JoinGroup
│   ├── .JoinBroadcast
│   ├── .AccessControl
│   └── .MsgComposer = MessageComposer       ← MessageComposerContext (see below)
├── .MessageFeed = MessageFeed               ← MessageFeedProvider context
│   ├── .PinnedMessages
│   ├── .ScrollToBottom
│   └── .MessageList = MessageList           ← MessageListProvider context
│       ├── .Loop = MessageLoop
│       ├── .ContextMenu
│       └── .MessageCard = MessageCard       ← MessageCardProvider context (× N)
│           ├── .Actions = MessageActions     ← No context (pure layout)
│           │   ├── .QuickActions
│           │   ├── .EmojiReaction
│           │   ├── .Reply
│           │   ├── .Bookmark
│           │   ├── .ReplyInThread
│           │   ├── .CopyLink
│           │   ├── .CopyToDoc
│           │   ├── .Delete
│           │   ├── .Edit
│           │   ├── .ReadStatus
│           │   ├── .GroupAuth
│           │   └── .HoverMenu
│           ├── .Header = MessageHeader       ← No context (pure layout)
│           │   ├── .BookmarkIndicator
│           │   ├── .Username
│           │   ├── .Timestamp
│           │   └── .UserAvatar
│           ├── .Content = MessageContent     ← No context (pure layout)
│           │   ├── .ReplyReference
│           │   ├── .CommentReference
│           │   └── .MessageBody
│           ├── .Footer = MessageFooter       ← No context (pure layout)
│           │   ├── .Indicators = MessageIndicators  ← No context (pure layout)
│           │   │   ├── .ReplyCount
│           │   │   ├── .EditedBadge
│           │   │   └── .MessageSeen
│           │   └── .Reactions = MessageReactions    ← No context (pure layout)
│           │       ├── .AddReactionButton
│           │       └── .ReactionList
│           └── .LongPressMenu
└── (Also) ChannelProvider                   ← DEAD context (only used in mobile, conflicting)
```

**MessageComposer sub-tree (separate root):**
```
MessageComposer                              ← MessageComposerContext
├── .EditorContent
├── .Toolbar
├── .BoldButton, .ItalicButton, .StrikethroughButton
├── .HyperlinkButton, .BulletListButton, .OrderedListButton
├── .BlockquoteButton, .CodeButton, .CodeBlockButton
├── .Context
├── .ReplyContext, .EditContext, .CommentContext
├── .Actions
├── .EmojiButton, .MentionButton, .SendButton
├── .ToggleToolbarButton, .AttachmentButton
├── .Input
├── .MobileWrapper
├── .MobileLayout, .DesktopLayout, .Editor
```

**EmojiPanel sub-tree:**
```
EmojiPanel                                   ← EmojiPanelProvider context
├── .Selector
└── .Picker
```

---

### 31.2 Metrics Summary

| Metric | Count | Industry Benchmark |
|--------|-------|--------------------|
| **React Contexts** | 7 (Chatroom, Feed, List, Card, Composer, Channel, Emoji) | 3–4 max for a chat widget |
| **Static sub-component exports** | 57 across all compound components | 15–25 for a Slack-level chat |
| **Max dot-chain depth in consumption** | **8 levels** (`Chatroom.MessageFeed.MessageList.MessageCard.Footer.Indicators.EditedBadge`) | 3 max (Radix/Headless UI standard) |
| **index.ts re-export files** | 18 in MessageCard subtree alone | Flat exports preferred |
| **Folder nesting depth** | 8 directories deep (MessageFooter→components→MessageIndicators→components→EditedBadge.tsx) | 4 max |
| **Dead/conflicting contexts** | 1 (`ChannelProvider` — conflicts with `ChatroomProvider`) | 0 |
| **Wrapper-only components** (just `<div className>` + children) | 8 (MessageActions, MessageHeader, MessageContent, MessageFooter, MessageIndicators, MessageReactions, QuickActions, ChannelComposerWrapper) | Should be CSS classes, not components |

---

### 31.3 Verdict: YES, It Is Over-Engineered

The compound component pattern is **correctly conceptualized** at the top two levels (`Chatroom → Toolbar/Feed/Composer`), but it is **over-applied** at the lower levels. Specifically:

#### 🔴 PROBLEM 1: Fractal Compound Pattern (Compounds inside Compounds inside Compounds)

The pattern was recursively applied to every visual grouping:

```
MessageCard            ← compound (correct)
  └── Footer           ← compound inside compound (questionable)
        └── Indicators ← compound inside compound inside compound (over-engineered)
              └── EditedBadge ← leaf (4 levels deep to reach a <span>)
```

**Industry standard:** Radix UI, Headless UI, and Shadcn/ui all limit compound depth to **2 levels max**. For example, Radix's `Dialog` has `Dialog.Trigger`, `Dialog.Content`, `Dialog.Title` — never `Dialog.Content.Body.Section.Title`.

**Why it matters:** Every compound level adds:
1. A new file + index.ts barrel
2. A directory in the tree
3. A `{ children, className }` wrapper component
4. An import chain for consumers

The result: 8-deep dot chains in consumption code that are **unreadable**:

```tsx
// Actual code from DesktopEditor.tsx — this is a single JSX element:
<Chatroom.MessageFeed.MessageList.MessageCard.Footer.Indicators.EditedBadge />
```

Compare to industry standard (Slack-like):

```tsx
// What it should look like:
<MessageCard.EditedBadge />
// or even:
<EditedBadge />
```

#### 🔴 PROBLEM 2: Wrapper-Only Components (Zero Logic, Just className + children)

Eight of the compound "containers" are literally:

```tsx
const MessageHeader = ({ className, children }: Props) => {
  return <div className={twMerge('message-header', className)}>{children}</div>
}
```

These are **not components in any meaningful sense.** They are CSS class wrappers. In industry-standard codebases, these would be:
1. A `<div className="message-header">` directly in the layout
2. Or a `cn()` utility call
3. Or at most, a slot-based API

Creating a full component file, directory, and barrel export for a `<div>` wrapper violates **KISS** and **YAGNI**.

#### 🔴 PROBLEM 3: The 8-Deep Consumption Chain Is a DX Failure

The consumer of this compound pattern (in `DesktopEditor.tsx`) writes code like:

```tsx
<Chatroom.MessageFeed.MessageList.MessageCard.Footer.Reactions.AddReactionButton />
```

This is **78 characters** to reference a button. Problems:
1. **No autocomplete benefit** — IDE has to resolve 7 property chains
2. **No tree-shaking** — the entire chain is loaded even if only one leaf is used
3. **Refactoring risk** — renaming any intermediate level breaks every consumer
4. **Readability** — the line wraps and obscures what the actual component is

Industry reference (Slack's internal patterns, Discord's component library):
```tsx
// Direct named imports for leaf components
import { AddReactionButton, EditedBadge, ReplyCount } from '@components/chatroom/message'

// Simple 1-level compound for the card structure
<MessageCard message={message}>
  <MessageCard.Header />
  <MessageCard.Body />
  <MessageCard.Footer />
</MessageCard>
```

#### 🟡 PROBLEM 4: Duplicate Layout Abstractions

There are **three separate layout-switching mechanisms**:

1. `ChatroomLayout` — switches between `DesktopLayout` / `MobileLayout` based on `variant` prop
2. `MessageComposer.Editor` — switches between `DesktopLayout` / `MobileLayout` based on `isMobile` from store
3. `Chatroom.DesktopLayout` / `Chatroom.MobileLayout` — exposed as static sub-components on root

This means the same "pick layout by device" logic exists in three places with three different data sources (`variant` prop, `isMobile` store, direct component selection).

#### 🟡 PROBLEM 5: ChannelProvider Is Dead Code That Creates Confusion

`ChannelProvider` (in `context/ChannelProvider.tsx`) provides:
- `channelId` + `setChannelId`
- `settings` (with feature flags like `contextMenue.edite`, `textEditor.mentionsomeone`)

But `ChatroomProvider` also provides `channelId`. The two contexts are **not connected** and have different data shapes. `ChannelProvider` is only consumed in `ChatContainerMobile.tsx`, where it wraps `Chatroom` — meaning both providers are active simultaneously with potentially different `channelId` values.

Additionally, `ChannelProvider` has **6 spelling errors** in its type definition: `contextMenue`, `edite`, `mentionsomeone`, `readedAt`, `MesageSeen`, `listner`.

#### 🟡 PROBLEM 6: MessageComposer Is a 546-Line God Component Pretending to Be Compound

`MessageComposer.tsx` exports 25 static sub-components (`Toolbar`, `BoldButton`, `ItalicButton`, etc.), making it look compound. But the component body itself is a **546-line monolith** containing:
- Editor initialization (Tiptap setup)
- Draft persistence (IndexedDB read/write)
- 4 different message sending functions (regular, thread, edit, comment)
- Content chunking logic
- Sign-in modal trigger
- Fake message creation
- 6 `useEffect` hooks
- Toolbar state management
- Context value construction with 20 properties

This violates **SRP** — it's not a compound component, it's a God Function that passes everything down via context. The sub-components (toolbar buttons) could work without the 546-line parent.

#### 🟢 WHAT'S DONE RIGHT

1. **Top-level compound on `Chatroom`** — the `Chatroom.Toolbar`, `Chatroom.MessageFeed`, `Chatroom.ChannelComposer` split is correct and follows Radix/Headless UI patterns
2. **`MessageCard` as a compound** — the Header/Content/Footer split maps naturally to the visual structure of a chat message
3. **Render callback in `MessageLoop`** — `{(message, index) => <MessageCard>...</MessageCard>}` is an elegant pattern for customizable rendering
4. **Layout flexibility** — desktop and mobile do successfully use different assemblies of the same primitives
5. **`ChannelComposer.AccessControl`** — the permission-routing logic is clean

---

### 31.4 Recommended Architecture: Industry-Standard Restructure

Below is the recommended restructure that follows the Radix UI / Headless UI / Shadcn conventions while keeping the composability benefits.

#### Principle 1: Maximum 2-Level Compound Depth

```
Chatroom                    ← Level 0 (root compound + context)
├── Chatroom.Toolbar        ← Level 1
├── Chatroom.Feed           ← Level 1 (merges Feed + List into one)
├── Chatroom.Composer       ← Level 1
└── Chatroom.AccessControl  ← Level 1
```

```
MessageCard                 ← Level 0 (compound + context)
├── MessageCard.Header      ← Level 1
├── MessageCard.Body        ← Level 1 (was Content)
├── MessageCard.Footer      ← Level 1
├── MessageCard.Actions     ← Level 1
└── MessageCard.LongPress   ← Level 1
```

**All leaf components are flat named exports:**

```tsx
// From @components/chatroom/message
export { MessageCard }           // compound root
export { UserAvatar }            // leaf — used in MessageCard.Header
export { Username }              // leaf
export { Timestamp }             // leaf
export { MessageBody }           // leaf — used in MessageCard.Body
export { ReplyReference }        // leaf
export { CommentReference }      // leaf
export { ReactionList }          // leaf — used in MessageCard.Footer
export { AddReactionButton }     // leaf
export { EditedBadge }           // leaf
export { ReplyCount }            // leaf
export { BookmarkIndicator }     // leaf
export { HoverMenuActions }      // pre-assembled action menu
```

#### Principle 2: Eliminate Wrapper-Only Components

**Before (current):**
```tsx
// MessageHeader.tsx — a whole file for this:
const MessageHeader = ({ className, children }) => (
  <div className={twMerge('message-header', className)}>{children}</div>
)
```

**After:**
```tsx
// In MessageCard compound:
MessageCard.Header = ({ className, children }) => (
  <div className={cn('message-header', className)}>{children}</div>
)
// OR — just use the className directly in the layout:
<div className="message-header">
  <Username />
  <Timestamp />
</div>
```

No separate file. No directory. No index.ts barrel. A slot component that's just a styled `<div>` gets defined **inline** on the compound root.

#### Principle 3: Merge Feed + List into One Context

**Before (current):** 3 contexts stacked for the message stream
```
MessageFeedProvider   → { isLoadingMore, loadingMoreDirection, messageContainerRef, virtualizerRef }
  └── MessageListProvider → { messages, messagesArray, isScrollingUp, messageContainerRef (!dup!), isLoadingMore (!dup!), virtualizerRef (!dup!) }
```

4 values (`isLoadingMore`, `loadingMoreDirection`, `messageContainerRef`, `virtualizerRef`) are duplicated between Feed and List contexts.

**After:** Single `MessageStreamProvider`
```tsx
const MessageStreamContext = createContext<{
  // Data
  messages: Map<string, TMessage>
  messagesArray: TMessage[]
  channelId: string
  // Pagination
  isLoadingMore: boolean
  loadingMoreDirection: 'older' | 'newer' | null
  // Virtualization
  messageContainerRef: RefObject<HTMLDivElement>
  virtualizerRef: MutableRefObject<Virtualizer | null>
  registerVirtualizer: (v: Virtualizer | null) => void
  // Scroll
  isScrollingUp: boolean
  // Sentinels
  topSentinelId: string
  bottomSentinelId: string
} | null>(null)
```

This eliminates one context layer, one provider, one file, and 4 duplicated values.

#### Principle 4: Extract MessageComposer Logic into a Hook

**Before:** 546-line `MessageComposer.tsx` that is both a component and a business logic hub.

**After:**
```tsx
// useMessageSubmit.ts — all submission logic
export function useMessageSubmit(channelId: string, editor: Editor) {
  // validateSubmission, prepareContent, sendSingleMessage,
  // sendChunkedMessages, handleThreadMessage, handleEditMessage,
  // handleCommentMessage, handleRegularMessage, cleanupAfterSubmit
  return { submitMessage, loading }
}

// useComposerDraft.ts — all draft persistence logic
export function useComposerDraft(channelId: string, editor: Editor) {
  // loadDraft, saveDraft, clearDraft
}

// MessageComposer.tsx — now ~80 lines
const MessageComposer = ({ children, className }) => {
  const { channelId } = useChatroomContext()
  const { editor, text, html, isEmojiOnly } = useTiptapEditor(...)
  const { submitMessage, loading } = useMessageSubmit(channelId, editor)
  const { isToolbarOpen, toggleToolbar } = useToolbarState(...)
  useComposerDraft(channelId, editor)

  return (
    <MessageComposerContext.Provider value={{ editor, submitMessage, loading, ... }}>
      <div className={cn('flex flex-col', className)}>{children}</div>
    </MessageComposerContext.Provider>
  )
}
```

#### Principle 5: Delete ChannelProvider (Dead Code)

`ChannelProvider` conflicts with `ChatroomProvider`, introduces 6 spelling errors into the type system, and is only used in one place where `ChatroomProvider` is already active. Delete it and migrate `ChatContainerMobile.tsx` to use feature flags from `ChatroomProvider` or a simple props-based config.

#### Principle 6: Flatten Consumption with Aliased Imports

**Before:**
```tsx
<Chatroom.MessageFeed.MessageList.MessageCard.Footer.Reactions.AddReactionButton />
```

**After (option A — destructure at consumption site):**
```tsx
const { Feed, Composer, Toolbar } = Chatroom
const { MessageCard } = Feed

// In JSX:
<Feed>
  <Feed.Loop>
    {(message, index) => (
      <MessageCard message={message} index={index}>
        <MessageCard.Header>
          <UserAvatar />
          <Username />
          <Timestamp />
        </MessageCard.Header>
        <MessageCard.Body>
          <ReplyReference />
          <MessageBody />
        </MessageCard.Body>
        <MessageCard.Footer>
          <ReactionList />
          <EditedBadge />
          <ReplyCount />
        </MessageCard.Footer>
      </MessageCard>
    )}
  </Feed.Loop>
</Feed>
```

**After (option B — pre-composed layouts as first-class exports):**
```tsx
// DesktopMessageCard.tsx — pre-composed for desktop
export const DesktopMessageCard = ({ message, index }) => (
  <MessageCard message={message} index={index}>
    <HoverMenuActions />
    <BookmarkIndicator />
    <MessageCard.Header>
      {message.isGroupStart && <UserAvatar />}
      <Username />
      <Timestamp />
    </MessageCard.Header>
    <MessageCard.Body>
      <ReplyReference />
      <CommentReference />
      <MessageBody />
    </MessageCard.Body>
    <MessageCard.Footer>
      <ReactionList />
      <AddReactionButton />
      <EditedBadge />
      <ReplyCount />
    </MessageCard.Footer>
  </MessageCard>
)
```

This is how Slack and Discord do it: the compound pattern defines the API, but **pre-composed variants** are the primary consumption path. Raw compound usage is reserved for deeply custom layouts.

---

### 31.5 File Structure: Before vs. After

**Before (current):** 8-level directory nesting, 18 index.ts barrels just in MessageCard

```
components/chatroom/components/MessageCard/
├── components/
│   ├── MessageActions/
│   │   ├── components/
│   │   │   ├── MoreActionsDropdown/
│   │   │   │   ├── components/
│   │   │   │   │   ├── CopyLinkAction.tsx
│   │   │   │   │   ├── CopyToDocAction.tsx
│   │   │   │   │   ├── DeleteAction.tsx
│   │   │   │   │   ├── EditAction.tsx
│   │   │   │   │   ├── ReadStatusDisplay.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   └── index.ts
│   │   │   ├── BookmarkButton.tsx
│   │   │   ├── EmojiReactionButton.tsx
│   │   │   ├── GroupAuth.tsx
│   │   │   ├── QuickActions.tsx
│   │   │   ├── ReplyButton.tsx
│   │   │   ├── ReplyInThreadButton.tsx
│   │   │   └── index.ts
│   │   ├── HoverMenuActions.tsx
│   │   ├── MessageActions.tsx
│   │   └── index.ts
│   ├── MessageContent/
│   │   ├── components/
│   │   │   ├── CommentReference.tsx
│   │   │   ├── MessageBody.tsx
│   │   │   ├── ReplyReference.tsx
│   │   │   └── index.ts
│   │   ├── MessageContent.tsx
│   │   └── index.ts
│   ├── MessageFooter/
│   │   ├── components/
│   │   │   ├── MessageIndicators/
│   │   │   │   ├── components/
│   │   │   │   │   ├── EditedBadge.tsx
│   │   │   │   │   ├── MesageSeen.tsx     ← spelling error
│   │   │   │   │   ├── ReplyCount.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   ├── MessageIndicators.tsx
│   │   │   │   └── index.ts
│   │   │   └── MessageReactions/
│   │   │       ├── components/
│   │   │       │   ├── AddReactionButton.tsx
│   │   │       │   ├── ReactionList.tsx
│   │   │       │   └── index.ts
│   │   │       ├── MessageReactions.tsx
│   │   │       └── index.ts
│   │   ├── MessageFooter.tsx
│   │   └── index.ts
│   ├── MessageHeader/
│   │   ├── components/
│   │   │   ├── BookmarkIndicator.tsx
│   │   │   ├── Timestamp.tsx
│   │   │   ├── UserAvatar.tsx
│   │   │   ├── Username.tsx
│   │   │   └── index.ts
│   │   ├── MessageHeader.tsx
│   │   └── index.ts
│   └── ... (more)
├── hooks/ (12 files)
├── helpers/
├── MessageCard.tsx
├── MessageCardContext.tsx
└── index.ts
```

**~60 files** for one message card component.

**After (recommended):** Flat structure, max 2 directories deep

```
components/chatroom/message/
├── MessageCard.tsx              ← compound root + context + slot definitions
├── message-parts/
│   ├── UserAvatar.tsx
│   ├── Username.tsx
│   ├── Timestamp.tsx
│   ├── MessageBody.tsx
│   ├── ReplyReference.tsx
│   ├── CommentReference.tsx
│   ├── BookmarkIndicator.tsx
│   ├── EditedBadge.tsx
│   ├── MessageSeen.tsx          ← fixed spelling
│   ├── ReplyCount.tsx
│   ├── ReactionList.tsx
│   └── AddReactionButton.tsx
├── message-actions/
│   ├── HoverMenuActions.tsx     ← pre-composed hover menu
│   ├── LongPressMenu.tsx
│   ├── ActionButtons.tsx        ← all action buttons in one file
│   └── GroupAuth.tsx
├── layouts/
│   ├── DesktopMessageCard.tsx   ← pre-composed desktop layout
│   └── MobileMessageCard.tsx    ← pre-composed mobile layout
├── hooks/
│   ├── useMessageActions.ts     ← consolidated (was 12 separate hooks)
│   └── useMessageMenu.ts       ← consolidated (visibility + positioning)
└── index.ts                     ← single flat barrel
```

**~25 files** — same functionality, 58% fewer files, 0 barrel re-export chains.

---

### 31.6 Context Restructure: 7 → 4

| Current Context | Verdict | Action |
|-----------------|---------|--------|
| `ChatroomProvider` | ✅ Keep | Root context for channelId, variant, dialog, subscription status |
| `MessageFeedProvider` | 🔴 Merge | Merge into `MessageStreamProvider` |
| `MessageListProvider` | 🔴 Merge | Merge into `MessageStreamProvider` |
| `MessageCardProvider` | ✅ Keep | Per-message context (correct — each card needs its own message ref) |
| `MessageComposerContext` | ✅ Keep | But strip to ~8 values (from current 20) |
| `ChannelProvider` | 🔴 Delete | Dead code, conflicts with ChatroomProvider |
| `EmojiPanelProvider` | 🟡 Questionable | Contains only `{ variant }` — pass as prop instead |

**After:** 4 contexts
1. `ChatroomContext` — room-level state
2. `MessageStreamContext` — pagination + virtualization + messages (merged Feed+List)
3. `MessageCardContext` — per-message data
4. `ComposerContext` — editor + submit (slimmed to ~8 values)

---

### 31.7 Action Hooks Consolidation: 12 → 3

Currently there are 12 separate hooks in `MessageCard/hooks/`, most under 30 lines:

| Hook | Lines | Can Merge Into |
|------|-------|---------------|
| `useBookmarkMessageHandler` | ~25 | `useMessageActions` |
| `useCopyMessageLinkHandler` | ~15 | `useMessageActions` |
| `useCopyMessageToDocHandler` | ~20 | `useMessageActions` |
| `useDeleteMessageHandler` | ~30 | `useMessageActions` |
| `useEditMessageHandler` | ~20 | `useMessageActions` |
| `usePinMessageHandler` | ~25 | `useMessageActions` |
| `useReplyInMessageHandler` | ~15 | `useMessageActions` |
| `useReplyInThreadHandler` | ~15 | `useMessageActions` |
| `useLongPressInteraction` | ~40 | `useMessageMenu` |
| `useMenuPositioning` | ~35 | `useMessageMenu` |
| `useMenuVisibility` | ~20 | `useMessageMenu` |
| `useMessageHighlighting` | ~25 | `useMessageMenu` |

**After:** 3 hooks
1. `useMessageActions()` — returns `{ bookmark, copyLink, copyToDoc, delete, edit, pin, reply, replyInThread }` — all action handlers in one object
2. `useMessageMenu()` — returns `{ isOpen, position, longPress, highlight }` — all menu state
3. `useMessageCardContext()` — unchanged (context hook)

Each "action" is still a separate function internally, but the developer experience is one import instead of twelve.

---

### 31.8 SOLID/DRY/KISS Compliance Scorecard

| Principle | Current Score | After Restructure | Details |
|-----------|--------------|-------------------|---------|
| **S** (Single Responsibility) | 4/10 | 8/10 | MessageComposer violates SRP. After extract: each hook does one thing |
| **O** (Open/Closed) | 7/10 | 9/10 | Compound pattern is open for extension. After flattening: leaf components can be added without modifying parents |
| **L** (Liskov Substitution) | 6/10 | 8/10 | Wrapper-only components are interchangeable with `<div>`. After removal: only real components remain |
| **I** (Interface Segregation) | 3/10 | 8/10 | `MessageComposerContext` has 20 values — consumers must depend on all. After slim: 8 values, split by concern |
| **D** (Dependency Inversion) | 5/10 | 7/10 | Leaf components reach into store directly. After: leaf components receive data via context or props only |
| **DRY** | 4/10 | 8/10 | 4 duplicated context values. After merge: zero duplication |
| **KISS** | 3/10 | 8/10 | 8-deep dot chain, 60 files for one card. After: 2-deep, 25 files |
| **YAGNI** | 4/10 | 8/10 | 8 wrapper-only components. After: removed or inlined |

**Composite score: 4.5/10 → 8.1/10**

---

### 31.9 Migration Roadmap

| Phase | Task | Files Changed | Risk |
|-------|------|--------------|------|
| **1** | Delete `ChannelProvider` + fix `ChatContainerMobile.tsx` | 2 files | 🟢 Low |
| **2** | Merge `MessageFeedContext` + `MessageListContext` → `MessageStreamContext` | 4 files | 🟡 Medium |
| **3** | Flatten MessageCard sub-components: remove intermediate wrapper components | 15 files deleted, 3 created | 🟡 Medium |
| **4** | Consolidate 12 action hooks → 3 | 12 files → 3 files | 🟡 Medium |
| **5** | Extract `useMessageSubmit` + `useComposerDraft` from `MessageComposer.tsx` | 3 files | 🟡 Medium |
| **6** | Create pre-composed `DesktopMessageCard` and `MobileMessageCard` | 2 new files | 🟢 Low |
| **7** | Slim `MessageComposerContext` from 20 values → 8 | 2 files | 🟡 Medium |
| **8** | Delete `EmojiPanelProvider` (pass `variant` as prop) | 3 files | 🟢 Low |
| **9** | Update consumption sites (`DesktopEditor.tsx`, `ChatContainerMobile.tsx`) to use flat imports | 2 files | 🟡 Medium |
| **10** | Delete all orphaned index.ts barrel files | ~15 files | 🟢 Low |

**Total:** ~60 files touched, ~30 files deleted, 5 new files. Net file count reduction: **~25 fewer files**.

---

### 31.10 Key Takeaways

> **"Compound components are an API design pattern, not a file organization strategy."**

The team correctly identified that a chat widget needs composability — different layouts for desktop, mobile, threads, and embedded contexts. The compound pattern is the right tool for this.

Where it went wrong: **the pattern was applied to visual structure (Header/Content/Footer) instead of behavioral boundaries (Message/Stream/Composer)**. Every `<div>` wrapper became a compound child, every leaf became a static property, and every grouping became a directory.

Industry-standard compound component usage:
- **Radix UI:** 2 levels max. `Dialog.Trigger`, `Dialog.Content`. Never `Dialog.Content.Body.Title`.
- **Headless UI:** Leaf components are flat imports. `<Listbox.Option>` not `<Listbox.Group.Item.Option>`.
- **Shadcn/ui:** Pre-composed variants for common cases. Raw compounds only for custom layouts.
- **Slack:** Flat component library. `<MessageBlock>`, `<MessageText>`, `<Avatar>` — no nesting.

The restructure proposed above gets this codebase to that level.

---

> 📋 **Review Checklist for Changes:**
> - [ ] Does the change follow the compound component pattern?
> - [ ] Are semantic color tokens used (no hardcoded hex/named colors)?
> - [ ] Is the change reflected in both desktop and mobile layouts?
> - [ ] Are TypeScript types properly defined (no `any`)?
> - [ ] Is the Zustand store shape documented if changed?
> - [ ] Are new hooks following the SRP pattern?
> - [ ] Is real-time subscription handling offline edge cases?
> - [ ] Is the IndexedDB draft persistence working correctly?
> - [ ] Are ARIA labels present on interactive elements?
> - [ ] Does the change work in dark mode?

---

## 32. UI/UX Design System Compliance Audit

> **Audit by:** UI/UX Design Department + Product Management Team
> **Reference:** `Notes/Design_System_Global_v2.md` v3.0.0
> **Scope:** All components under `packages/webapp/src/components/chatroom/`
> **Date:** 2026-02-12

---

### 32.1 Executive Summary

The chatroom feature was built **before** the Design System v3.0 was formalized. As a result, it has significant deviations from the established standards. The newer components (Channel Composer variants, Toolbar buttons) show **good compliance** — they use Lucide icons, daisyUI semantic tokens, and shared `Button` components. However, the core message components (MessageCard, ContextMenus, Composer Contexts, MessageContent) carry **legacy patterns** that violate nearly every section of the design system.

#### Compliance Scorecard

| Design System Section | Score | Status |
|---|---|---|
| §2.1 — Semantic color tokens | **3/10** | 🔴 Critical — 35+ hardcoded color violations |
| §2.3 — ScrollArea for all scroll | **1/10** | 🔴 Critical — Zero ScrollArea usage |
| §3.2 — Radius tokens | **5/10** | 🟡 Warning — Arbitrary radii in 5+ components |
| §3.5 — Lucide icons only | **3/10** | 🔴 Critical — 20+ files use non-Lucide icons |
| §5.1 — Button consistency | **7/10** | 🟢 Good — Shared `Button` used in most places |
| §5.7 — Skeleton patterns | **2/10** | 🔴 Critical — No message card skeletons |
| §5.10 — Channel access states | **9/10** | 🟢 Excellent — Near-perfect compliance |
| §6.1 — Modal/overlay tokens | **5/10** | 🟡 Warning — Hardcoded rgba in overlays |
| §8.2 — Animation durations | **6/10** | 🟡 Warning — Some non-standard durations |
| §9.2 — Touch targets (44px) | **4/10** | 🔴 Critical — Multiple sub-44px targets |
| §10 — Accessibility | **3/10** | 🔴 Critical — Zero focus states, sparse ARIA |
| Dark mode safety | **2/10** | 🔴 Critical — Zero `dark:` overrides + hardcoded colors |

**Overall Design System Compliance: 3.8 / 10**

---

### 32.2 Detailed Findings

#### 32.2.1 🔴 CRITICAL — Hardcoded Colors (Violates §2.1)

The design system **non-negotiably** states: *"Never use Tailwind palette colors (`slate-*`, `zinc-*`, `stone-*`), hardcoded colors (`bg-white`, `text-black`)"*

**Every violation found:**

| Violation | File(s) | DS Replacement |
|---|---|---|
| `text-red-500` | `MessageContextMenu/ContextMenuItems.tsx`, `LongPressMenuItems.tsx` | `text-error` |
| `text-blue-600` | `BookmarkIndicator.tsx` | `text-primary` |
| `text-gray-600` | `QuickReactionMenu.tsx`, `HoverMenuActions.tsx` | `text-base-content/60` |
| `text-gray-400` | `QuickReactionMenu.tsx`, `MesageSeen.tsx` | `text-base-content/40` |
| `text-slate-800` | `ThreadHeader.tsx` | `text-base-content` |
| `text-slate-600` | `DeleteMessageConfirmationDialog.tsx` | `text-base-content/60` |
| `bg-white` | `QuickReactionMenu.tsx` | `bg-base-100` |
| `bg-gray-200` | `QuickReactionMenu.tsx` | `bg-base-300` |
| `border-gray-200` | `ReplyContext.tsx`, `EditContext.tsx`, `CommentContext.tsx` | `border-base-300` |
| `border-gray-300` | `HoverMenuActions.tsx`, `DeleteAction.tsx`, `ContextMenuItems.tsx` | `border-base-300` |
| `border-cyan-400` | `ReplyReference.tsx`, `CommentReference.tsx` | `border-primary` or `border-info` |
| `text-docsy` | `ContextMenuItems.tsx`, `MesageSeen.tsx` | `text-primary` (custom token, not in DS) |
| `bg-bg-chatBubble-owner` | `SystemNotifyChip.tsx` | Not a daisyUI token — maps to hardcoded `#a6c5fa` |

**Hardcoded SCSS colors (globals.scss):**

| Violation | Location | DS Replacement |
|---|---|---|
| `#a6c5fa` | `.bg-chatBubble-owner` | `bg-primary/20` or new daisyUI theme variable |
| `#f0f4ff` | `.msg_card.context-menu-active` | `bg-primary/10` |
| `#93c5fd` / `#3b82f6` | `@keyframes border-ping-glow` | `oklch(var(--p))` (primary color var) |

**Hardcoded rgba() in inline styles and Framer Motion:**

| Violation | File | DS Replacement |
|---|---|---|
| `rgba(0,0,0,0.2)` | `MessageLongPressMenu.tsx` backdrop | `bg-base-content/20` |
| `rgba(0,0,0,0.05)` | `LongPressMenuItems.tsx` whileTap | `bg-base-content/5` |
| `rgba(0,0,0,0.1)` | `QuickReactionMenu.tsx` whileTap | `bg-base-content/10` |
| `rgba(0,0,0,0.15)` | `QuickReactionMenu.tsx` more-emojis shadow | Use `shadow-lg` or computed CSS var |
| `shadow-[0_-2px_6px_-1px_rgba(0,0,0,0.1)]` | `ReplyContext.tsx`, `EditContext.tsx`, `CommentContext.tsx` | `shadow-sm` or `shadow-md` |

**Total: 35+ hardcoded color violations across 18+ files**

---

#### 32.2.2 🔴 CRITICAL — Icon Library Fragmentation (Violates §3.5)

The design system mandates: *"Use Lucide React (`react-icons/lu`) for all UI icons"*

**Current state: 6 different icon libraries used**

| Library | Import Prefix | Files Using | Example Icons |
|---|---|---|---|
| `react-icons/md` (Material) | `Md*` | **20+** | `MdDeleteOutline`, `MdOutlineEdit`, `MdMoreVert`, `MdOutlineBookmarkAdd`, `MdOutlineEmojiEmotions`, `MdCheck`, `MdOutlineLink`, `MdOutlineComment`, `MdOutlineFileOpen`, `MdInsertComment`, `MdAccessTime`, `MdAdd`, `MdGroups`, `MdLink`, `MdOutlineAddReaction` |
| `react-icons/bs` (Bootstrap) | `Bs*` | 2 | `BsFillPinAngleFill`, `BsFillPinFill`, `BsForwardFill` |
| `react-icons/vsc` (VS Code) | `Vsc*` | 1 | `VscPinnedDirty` |
| `react-icons/ri` (Remix) | `Ri*` | 2 | `RiArrowRightSLine`, `RiPencilFill` |
| `react-icons/fa` (FontAwesome) | `Fa*` | 1 | `FaReply` |
| `react-icons/io5` (Ionicons) | `Io*` | 1 | `IoCheckmarkSharp`, `IoCheckmarkDoneSharp` |
| `react-icons/cg` | `Cg*` | 1 | `CgMailReply` |
| ✅ `react-icons/lu` (Lucide) | `Lu*` | **9 → 14** (v1.7.0) | `LuBell`, `LuBellOff`, `LuAtSign`, `LuUserPlus`, `LuLink`, `LuX`, `LuCopy`, `LuCheck`, `LuChevronRight`, `LuLogIn`, `LuLock`, `LuMessageSquare`, `LuPencil` |

**Ratio: ~~28 non-Lucide files vs 9 Lucide files (76% non-compliant)~~ Updated v1.7.0: 23 non-Lucide files vs 14 Lucide files (62% non-compliant) — toolbar components migrated**

**Recommended Lucide replacements:**

| Current Icon | → Lucide Equivalent |
|---|---|
| `MdDeleteOutline` | `LuTrash2` |
| `MdOutlineEdit` | `LuPencil` |
| `MdMoreVert` | `LuMoreVertical` |
| `MdOutlineBookmarkAdd` / `MdBookmarkRemove` | `LuBookmark` / `LuBookmarkMinus` |
| `MdOutlineEmojiEmotions` | `LuSmile` |
| `MdCheck` | `LuCheck` |
| `MdOutlineLink` | `LuLink` |
| `MdOutlineComment` | `LuMessageSquare` |
| `MdOutlineFileOpen` | `LuFileText` |
| `MdInsertComment` | `LuMessageSquareQuote` |
| `MdAccessTime` | `LuClock` |
| `MdAdd` | `LuPlus` |
| `MdGroups` | `LuUsers` |
| `MdOutlineAddReaction` | `LuSmilePlus` |
| `BsFillPinAngleFill` / `BsFillPinFill` | `LuPin` / `LuPinOff` |
| `BsForwardFill` | `LuForward` |
| `VscPinnedDirty` | `LuPin` |
| `RiArrowRightSLine` | `LuChevronRight` |
| `RiPencilFill` | `LuPencil` |
| `FaReply` | `LuReply` |
| `IoCheckmarkSharp` / `IoCheckmarkDoneSharp` | `LuCheck` / `LuCheckCheck` |
| `CgMailReply` | `LuReply` |

---

#### 32.2.3 🔴 CRITICAL — Zero Focus States (Violates §10)

**ZERO** `focus:`, `focus-visible:`, or `focus-within:` classes found across the entire chatroom directory.

The design system states: *"Visible focus states (don't remove outline without replacement)"* and *"Keyboard navigation for all interactive controls"*

**Impact:**
- Keyboard users cannot see which element is focused
- Screen reader users get no visual feedback
- Fails WCAG 2.1 AA (2.4.7 Focus Visible)

**Components needing focus states:**

| Component | Interactive Elements Needing Focus |
|---|---|
| `QuickActions` buttons | Emoji, Reply, Thread, Bookmark |
| `HoverMenuDropdown` trigger | More actions |
| `ContextMenuItems` menu items | All context menu entries |
| `QuickReactionMenu` emoji buttons | All reaction buttons |
| `PinnedMessagesSlider` nav buttons | Step indicators |
| `ToolbarButton` (composer) | Bold, Italic, etc. |
| `ReplyContext` / `EditContext` close button | Already uses `CloseButton` (may have built-in focus) |

---

#### 32.2.4 🔴 CRITICAL — Zero ScrollArea Usage (Violates §2.3)

The design system states: *"If an element can scroll, it must use the shared ScrollArea component"*

**Current state: ZERO imports of `ScrollArea` in the chatroom directory**

Scrollable elements using native scroll:
- Message feed list (virtual scroll via Tanstack Virtual)
- `QuickReactionMenu` — uses `overflow-x-auto` + `scrollbar-hide` + inline `scrollbarWidth: 'none'`
- Mention list dropdown — `overflow-y-auto`

**Note:** The message feed uses Tanstack Virtual, which requires a native scroll container. This is a valid exception (similar to the TipTap editor exception in §2.3). However, the `QuickReactionMenu` and `MentionList` should use `ScrollArea`.

---

#### 32.2.5 🟡 WARNING — Radius Token Violations (Violates §3.2)

Design system tokens: `rounded-box` (16px), `rounded-field` (8px), `rounded-selector` (8px), `rounded-full`

| Violation | File | DS Replacement |
|---|---|---|
| `rounded-3xl` | `QuickReactionMenu.tsx` | `rounded-box` |
| `rounded-lg` | Multiple components | `rounded-field` or `rounded-selector` |
| `rounded-md` | `QuickActions.tsx` | `rounded-selector` |

---

#### 32.2.6 🔴 CRITICAL — Dark Mode Completely Broken

**ZERO `dark:` prefixes found in the entire chatroom directory.**

While daisyUI semantic tokens (e.g., `bg-base-100`, `text-base-content`) automatically adapt to themes, **every hardcoded color from §32.2.1 will break in dark mode:**

| What Breaks | Visual Result in Dark Mode |
|---|---|
| `bg-white` (QuickReactionMenu) | Blinding white panel on dark background |
| `text-slate-800` (ThreadHeader) | Near-invisible text on dark background |
| `text-gray-400/500/600` (various) | Incorrect contrast ratios |
| `border-gray-200/300` (Composer contexts) | Invisible borders |
| `#a6c5fa` (chatBubble-owner SCSS) | Clashing light blue on dark surface |
| `#f0f4ff` (context-menu-active SCSS) | Light flash on right-click |
| `rgba(0,0,0,0.2)` (LongPress backdrop) | Works but not theme-aware |
| `border-cyan-400` (Reply/Comment reference) | Fixed cyan, not theme-aware |

**The entire chatroom will look broken in dark mode.** This is not a gradual issue — it's a complete failure of theme support.

---

#### 32.2.7 🟡 WARNING — Touch Target Violations (Violates §9.2)

Design system: *"Minimum 44×44px for tap areas"*

| Component | Current Size | Minimum | Gap |
|---|---|---|---|
| `QuickReactionMenu` emoji buttons | `size-10` (40px) | 44px | 🟡 -4px |
| Composer `ToolbarButton` | `size-8` (32px) | 44px | 🔴 -12px |
| `PinnedMessagesSlider` nav dots | `w-1` (4px) | 44px | 🔴 -40px |
| ~~`btn-sm` in mobile toolbar~~ | ~~32px height~~ | ~~44px~~ | ✅ Fixed v1.7.0 — all mobile toolbar buttons now use `size="sm"` (44px) |

**Note:** The `PinnedMessagesSlider` nav dots are **4px wide** — this is virtually un-tappable on mobile. They need padding or a larger hit area.

---

#### 32.2.8 🟡 WARNING — Skeleton/Loading Patterns (Violates §5.7)

| Pattern | DS Expectation | Current State |
|---|---|---|
| Message feed loading | Panel skeleton with message-shaped placeholders | Simple centered spinner (`MessageFeedLoading.tsx`) |
| Message card skeleton | Skeleton with avatar + text lines | ❌ Does not exist |
| Infinite scroll loading | `loading loading-spinner loading-sm text-primary` | ✅ `LoadingSpinner.tsx` matches |
| Error state | Badge with error styling | ✅ `MessageFeedError.tsx` uses `badge badge-error` |

**Missing:** A proper message card skeleton would significantly improve perceived performance during initial load and infinite scroll loads.

---

#### 32.2.9 🟡 WARNING — Empty State (Violates §5.6)

`MessagesEmptyState.tsx` renders a blank `<div>` — no illustration, no text, no call-to-action.

The design system pattern for empty states expects at minimum: an icon, a descriptive message, and optionally a CTA.

```tsx
// Current (empty)
const MessagesEmptyState = () => <div />

// Expected per DS
const MessagesEmptyState = () => (
  <div className="flex flex-col items-center gap-3 py-12 text-center">
    <LuMessageSquare size={48} className="text-base-content/30" />
    <p className="text-base-content/50 text-sm">No messages yet</p>
    <p className="text-base-content/40 text-xs">Start the conversation!</p>
  </div>
)
```

---

#### 32.2.10 🔴 CRITICAL — Duplicate Context Menu Definitions

Two **near-identical** 160-line components define the same menu items:

| | Desktop | Mobile |
|---|---|---|
| **File** | `MessageContextMenu/ContextMenuItems.tsx` | `MessageLongPressMenu/components/ContextMenuItems.tsx` |
| **Lines** | 184 | 165 |
| **Menu items** | 10 (Reply, Add Reaction, Copy Link, Bookmark, Copy to Doc, Reply in Thread, Forward, Pin, Edit, Delete) | 9 (same minus Add Reaction) |
| **Icons** | Identical | Identical |
| **Handlers** | Identical hooks | Identical hooks |
| **Differences** | Uses `MenuItem` + `useContextMenuContext` | Uses `motion.li` + `useMessageLongPressMenu` |

**Design impact:** If a PM adds a new menu item, designers must ensure it appears in BOTH files with consistent ordering and styling. This has already diverged — desktop has "Add Reaction" but mobile does not.

**Solution:** Extract a shared `useContextMenuActions(message)` hook that returns the action list. Each platform renders it with its own wrapper component.

---

#### 32.2.11 🟢 GOOD — Channel Access States (§5.10 Compliance)

The Channel Composer variants (`JoinBroadcastChannel`, `JoinGroupChannel`, `JoinPrivateChannel`, `JoinDirectChannel`, `SignInToJoinChannel`) are **near-perfectly compliant**:

✅ Use `variant="primary"` for join CTAs
✅ Use `variant="ghost"` for mute toggle
✅ Use Lucide icons (`LuUserPlus`, `LuBell`, `LuBellOff`, `LuLock`, `LuMessageSquare`, `LuLogIn`)
✅ Use daisyUI semantic tokens (`bg-base-100`, `border-base-300`, `text-base-content/60`, `bg-base-200`)
✅ Info pills use `rounded-full`
✅ Container uses `border-t p-3`

These components were clearly built **after** the design system was established and serve as a model for the rest of the chatroom.

---

#### 32.2.12 🟢 EXCELLENT — Toolbar Components (Updated v1.7.0)

The `ChatroomToolbar` sub-components (`ShareButton`, `CloseButton`, `NotificationToggle`, `Breadcrumb`, `BreadcrumbMobile`) are now fully compliant after v1.7.0 redesign:

✅ All Lucide icons (`LuLink`, `LuX`, `LuBell`/`LuBellOff`/`LuAtSign`, `LuChevronRight`)
✅ Use shared `Button` component with consistent variants
✅ `focus-visible:ring-2 ring-primary/30` on all action buttons
✅ `text-base-content/60 hover:text-base-content` semantic color transitions
✅ `ChatroomToolbar` root component now includes default styling (`bg-base-100 border-b px-3 py-1.5`)
✅ Action group uses `rounded-selector` container
✅ `CopyButton` supports `square` prop — prevents label text expansion / layout shift
✅ `NotificationToggle` tooltip wrapper removed — uses `title` attribute instead
✅ Mobile: all action buttons use `size="sm"` for 44px touch targets
✅ `BreadcrumbMobile` redesigned: two-line stacked header (muted ancestor path + primary current heading)

---

#### 32.2.13 🟡 WARNING — Composer Context Banners Inconsistency

`ReplyContext`, `EditContext`, and `CommentContext` share an identical visual pattern but implement it independently:

| Property | ReplyContext | EditContext | CommentContext |
|---|---|---|---|
| Border | `border border-b-0 border-gray-200` | same | same |
| Shadow | `shadow-[0_-2px_6px_...]` | same | same |
| Layout | `flex items-center justify-between` | same | same |
| Icon | `FaReply` (FontAwesome) | `RiPencilFill` (Remix) | `MdInsertComment` (Material) |
| Title style | `text-primary font-semibold` | same | N/A (no title) |
| Close | `CloseButton size="xs"` | same | same |

**Issues:**
1. Three different icon libraries for three related components
2. Hardcoded `border-gray-200` and `shadow-[...]` (not theme-safe)
3. Duplicate layout CSS in each file
4. Typo: "Edite message" in EditContext.tsx line 28

**Solution:** Extract a shared `ComposerContextBanner` component:
```tsx
<ComposerContextBanner icon={LuReply} title="Reply to" subtitle={userName} onClose={handleClose}>
  {messagePreview}
</ComposerContextBanner>
```

---

#### 32.2.14 ⚠️ NOTICE — Framer Motion Hardcoded Styles

Several Framer Motion `whileTap` / `animate` props use hardcoded colors:

```tsx
// LongPressMenuItems.tsx
whileTap={{
  backgroundColor: 'rgba(0,0,0,0.05)',  // Not theme-aware
}}

// QuickReactionMenu.tsx
whileTap={{
  backgroundColor: 'rgba(0,0,0,0.1)',   // Not theme-aware
}}
```

In dark mode, `rgba(0,0,0,0.05)` on a dark surface is invisible. Should use CSS variables:
```tsx
whileTap={{
  backgroundColor: 'oklch(var(--bc) / 0.05)',  // --bc = base-content
}}
```

---

### 32.3 Component-by-Component Compliance Matrix

| Component | Colors | Icons | Radius | Focus | Touch | ARIA | Dark | Score |
|---|---|---|---|---|---|---|---|---|
| **ChannelComposer variants** | ✅ | ✅ | ✅ | ⚠️ | ✅ | ⚠️ | ✅ | 8/10 |
| **ChatroomToolbar** | ✅ | ✅ | ✅ | ✅ v1.7 | ✅ | ✅ | ✅ | **10/10** ✅ |
| **ThreadHeader** | ✅ v1.7 | N/A | ✅ | ⚠️ | ✅ | ✅ | ✅ v1.7 | **8/10** ✅ |
| **PinnedMessagesSlider** | ✅ | ❌ `Vsc*` | ✅ | ❌ | ❌ 4px | ✅ | ✅ | 4/10 |
| **MessageCard** | ⚠️ | N/A | ✅ | ❌ | ✅ | ⚠️ | ⚠️ | 5/10 |
| **MessageHeader** | ⚠️ | ❌ `Md*` | ✅ | ❌ | ✅ | ⚠️ | ⚠️ | 4/10 |
| **BookmarkIndicator** | ❌ `blue-600` | ❌ `Md*` | ✅ | N/A | N/A | ⚠️ | ❌ | 2/10 |
| **MessageContent** | ✅ | N/A | ✅ | N/A | N/A | N/A | ✅ | 8/10 |
| **ReplyReference** | ❌ `cyan-400` | N/A | ✅ | N/A | N/A | ⚠️ | ❌ | 3/10 |
| **CommentReference** | ❌ `cyan-400` | ❌ `Md*` | ✅ | N/A | N/A | ⚠️ | ❌ | 3/10 |
| **MessageFooter** | ✅ | ❌ `Md*`,`Io*`,`Cg*` | ✅ | ❌ | ⚠️ | ⚠️ | ⚠️ | 4/10 |
| **MessageSeen** | ❌ `gray-400` | ❌ `Io*` | N/A | N/A | N/A | ❌ | ❌ | 2/10 |
| **ReactionList** | ✅ | N/A | ✅ | ❌ | ⚠️ | ⚠️ | ✅ | 5/10 |
| **AddReactionButton** | ✅ | ❌ `Md*` | ✅ | ❌ | ⚠️ | ⚠️ | ✅ | 4/10 |
| **HoverMenuActions** | ❌ `gray-600`,`gray-300` | ❌ `Md*` | ✅ | ❌ | ✅ | ⚠️ | ❌ | 3/10 |
| **QuickActions** | ✅ | N/A | ❌ `rounded-md` | ❌ | ✅ | ⚠️ | ✅ | 5/10 |
| **ContextMenuItems (desktop)** | ❌ `red-500`,`gray-300` | ❌ `Md*`,`Bs*` | N/A | ❌ | N/A | ⚠️ | ❌ | 2/10 |
| **ContextMenuItems (mobile)** | ❌ `red-500` | ❌ `Md*`,`Bs*` | N/A | N/A | ✅ | ⚠️ | ❌ | 3/10 |
| **QuickReactionMenu** | ❌ `bg-white`,`gray-*` | ❌ `Md*` | ❌ `rounded-3xl` | ❌ | ❌ 40px | ⚠️ | ❌ | 1/10 |
| **MessageLongPressMenu** | ❌ rgba | N/A | ✅ | N/A | ✅ | ⚠️ | ❌ | 3/10 |
| **MessageComposer** | ✅ | N/A | ✅ | ⚠️ | ✅ | ⚠️ | ✅ | 6/10 |
| **ToolbarButton (composer)** | ✅ | N/A | ✅ | ❌ | ❌ 32px | ✅ | ✅ | 5/10 |
| **ReplyContext** | ❌ `gray-200`, shadow | ❌ `Fa*` | ✅ | ⚠️ | ✅ | ✅ | ❌ | 3/10 |
| **EditContext** | ❌ `gray-200`, shadow | ❌ `Ri*` | ✅ | ⚠️ | ✅ | ✅ | ❌ | 3/10 |
| **CommentContext** | ❌ `gray-200`, shadow | ❌ `Md*` | ✅ | ⚠️ | ✅ | ✅ | ❌ | 3/10 |
| **SystemNotifyChip** | ❌ custom class | N/A | ✅ | N/A | N/A | ⚠️ | ❌ | 3/10 |
| **DateChip** | ✅ | N/A | ✅ | N/A | N/A | ⚠️ | ✅ | 7/10 |
| **UnreadIndicatorLine** | ✅ | N/A | N/A | N/A | N/A | ⚠️ | ✅ | 7/10 |
| **MessageFeedLoading** | ✅ | N/A | N/A | N/A | N/A | ⚠️ | ✅ | 6/10 |
| **MessageFeedError** | ✅ | N/A | N/A | N/A | N/A | ⚠️ | ✅ | 7/10 |
| **MessagesEmptyState** | N/A | N/A | N/A | N/A | N/A | ❌ | N/A | 1/10 |
| **DeleteConfirmationDialog** | ❌ `slate-600` | ❌ `Md*` | ✅ | ⚠️ | ✅ | ⚠️ | ❌ | 4/10 |
| **LoadingSpinner** | ✅ | N/A | N/A | N/A | N/A | ⚠️ | ✅ | 7/10 |
| **MentionList/Item** | ⚠️ | ❌ `Md*` | ⚠️ | ❌ | ⚠️ | ⚠️ | ⚠️ | 3/10 |
| **ScrollToBottomButton** | ✅ | N/A | ✅ | ❌ | ⚠️ | ❌ | ✅ | 4/10 |
| **BreadcrumbMobile** | ✅ | ✅ v1.7 `Lu*` | ✅ | ⚠️ | ✅ | ✅ v1.7 | ✅ | **8/10** ✅ |

---

### 32.4 UI Copy / Content Issues

| Issue | File | Line | Fix |
|---|---|---|---|
| **Typo:** "Edite message" | `EditContext.tsx` | 28 | → "Edit message" |
| **Console.log in production:** `console.log('Open full emoji picker')` | `QuickReactionMenu.tsx` | 52 | Remove |
| **Console.log in production:** `console.log(\`Reacted with...\`)` | `MessageLongPressMenu.tsx` | 121 | Remove |
| **Commented-out code** | `ContextMenuItems.tsx` (both) | Multiple | Remove `//settings.contextMenue?.` comments |
| **Inconsistent capitalization:** "Reply in Thread" vs "Reply to Message" | Context menus | — | Standardize to "Reply in thread" / "Reply to message" |

---

### 32.5 Design Cohesion Issues

#### 32.5.1 — Visual Language Fragmentation

The chatroom mixes **three distinct visual languages:**

1. **Legacy Material Design** — Material icons (`Md*`), Material-style outlined icons, `text-gray-*` palette
2. **Bootstrap/VS Code** — Pin icons from Bootstrap (`Bs*`), VS Code (`Vsc*`), mixed with FontAwesome
3. **Modern docs.plus** — Lucide icons, daisyUI semantic tokens, shared Button component

This creates a "patchwork" feel where the Channel Composer looks modern but the MessageCard/ContextMenu looks like a different app.

#### 32.5.2 — Reply/Comment Reference Border Accent

`ReplyReference` and `CommentReference` use `border-cyan-400` for the left accent border. This color:
- Is not in the design system color palette
- Does not map to any semantic role (not primary, info, accent, or secondary)
- Is hardcoded and will not adapt to themes

**Recommendation:** Use `border-primary` (matches the blue CTA color) or `border-info` (matches informational context).

#### 32.5.3 — Hover Menu vs Context Menu Visual Inconsistency

| Aspect | Hover Menu (Desktop) | Context Menu (Desktop) | Long Press Menu (Mobile) |
|---|---|---|---|
| Container | `join bg-base-300 rounded-md shadow-xs` | Browser context menu styling | `bg-white rounded-3xl shadow-lg` |
| Item style | Icon buttons in join group | `<a>` tags in `<li>` | `motion.li` with flex layout |
| Separator | `border-t border-gray-300` | `border-b border-base-300` | `border-t border-base-300` |
| Delete color | `text-error` (via component) | `text-red-500` | `text-red-500` |

Three different visual patterns for the same conceptual action. The design system expects consistency.

---

### 32.6 Prioritized Roadmap

#### Phase 1 — Quick Wins (1-2 days, zero behavior changes)

| # | Task | Files | Impact |
|---|---|---|---|
| 1.1 | Replace all `text-red-500` → `text-error` | 2 | Dark mode safe |
| 1.2 | Replace all `text-gray-*` → `text-base-content/*` | 6 | Dark mode safe |
| 1.3 | Replace `text-slate-*` → `text-base-content` | 2 | Dark mode safe |
| 1.4 | Replace `text-blue-600` → `text-primary` | 1 | Dark mode safe |
| 1.5 | Replace `bg-white` → `bg-base-100` | 1 | Dark mode safe |
| 1.6 | Replace `bg-gray-200` → `bg-base-300` | 1 | Dark mode safe |
| 1.7 | Replace `border-gray-*` → `border-base-300` | 5 | Dark mode safe |
| 1.8 | Replace `border-cyan-400` → `border-primary` | 2 | Semantic color |
| 1.9 | Replace hardcoded shadow → `shadow-sm` | 3 | DS compliant |
| 1.10 | Fix typo "Edite message" → "Edit message" | 1 | Copy fix |
| 1.11 | Remove `console.log` in QuickReactionMenu and LongPressMenu | 2 | Clean |

**Estimated effort: 1 day. Changes are find-and-replace. Zero risk.**

#### Phase 2 — Icon Migration (2-3 days)

| # | Task | Files | Impact |
|---|---|---|---|
| 2.1 | Replace all `Md*` imports → `Lu*` equivalents | 20+ | Visual consistency |
| 2.2 | Replace `Bs*` → `Lu*` (pin, forward) | 2 | Visual consistency |
| 2.3 | Replace `Vsc*` → `Lu*` (pinned) | 1 | Visual consistency |
| 2.4 | Replace `Ri*` → `Lu*` (arrow, pencil) | 2 | Visual consistency |
| 2.5 | Replace `Fa*` → `Lu*` (reply) | 1 | Visual consistency |
| 2.6 | Replace `Io*` → `Lu*` (checkmarks) | 1 | Visual consistency |
| 2.7 | Replace `Cg*` → `Lu*` (reply) | 1 | Visual consistency |
| 2.8 | Verify icon sizes match DS (14/16/18/20px) | All | Consistent sizing |

**Estimated effort: 2 days. Purely visual change. QA with screenshot comparison.**

#### Phase 3 — Radius & Scroll Compliance (1 day)

| # | Task | Files | Impact |
|---|---|---|---|
| 3.1 | Replace `rounded-3xl` → `rounded-box` | 1 | DS token |
| 3.2 | Replace `rounded-md` → `rounded-selector` | 1 | DS token |
| 3.3 | Replace `rounded-lg` → `rounded-field` / `rounded-selector` | ~3 | DS token |
| 3.4 | Migrate `QuickReactionMenu` scroll to `ScrollArea` | 1 | Scroll consistency |
| 3.5 | Migrate `MentionList` scroll to `ScrollArea` | 1 | Scroll consistency |

#### Phase 4 — Accessibility (2-3 days)

| # | Task | Files | Impact |
|---|---|---|---|
| 4.1 | Add `focus-visible:ring-2 ring-primary ring-offset-2` to all interactive elements | ~15 | WCAG 2.4.7 |
| 4.2 | Add `aria-label` to all icon-only buttons | ~10 | Screen reader support |
| 4.3 | Add `role="menu"` / `role="menuitem"` to context menus | 3 | Semantic markup |
| 4.4 | Add keyboard navigation (ArrowUp/Down) to context menus | 3 | Keyboard accessibility |
| 4.5 | Increase PinnedMessagesSlider tap targets to 44px | 1 | Touch accessibility |
| 4.6 | Increase ToolbarButton to min 44px on mobile | 1 | Touch accessibility |
| 4.7 | Add `aria-live="polite"` to dynamic content (new messages) | 1 | Screen reader feedback |

#### Phase 5 — SCSS Hardcoded Colors (1 day)

| # | Task | Files | Impact |
|---|---|---|---|
| 5.1 | Replace `#a6c5fa` → `oklch(var(--p) / 0.3)` in `.bg-chatBubble-owner` | 1 | Theme-safe |
| 5.2 | Replace `#f0f4ff` → `oklch(var(--p) / 0.1)` in `.context-menu-active` | 1 | Theme-safe |
| 5.3 | Replace `#93c5fd` / `#3b82f6` → `oklch(var(--p))` in `border-ping-glow` | 1 | Theme-safe |
| 5.4 | Replace Framer Motion `rgba()` → CSS variable equivalents | 3 | Theme-safe |

#### Phase 6 — Structural DRY Improvements (2-3 days)

| # | Task | Impact |
|---|---|---|
| 6.1 | Extract shared `useContextMenuActions(message)` hook | Eliminates duplicate 160-line menu definitions |
| 6.2 | Create `ComposerContextBanner` shared component | DRY for Reply/Edit/Comment contexts |
| 6.3 | Build `MessageCardSkeleton` component | Better loading UX |
| 6.4 | Build proper `MessagesEmptyState` with icon + text | Better empty UX |
| 6.5 | Standardize Framer Motion animation tokens | Consistent micro-interactions |

#### Phase 7 — Dark Mode Verification (1 day)

| # | Task | Impact |
|---|---|---|
| 7.1 | After Phases 1-5, toggle dark theme and screenshot every state | Verify all fixes |
| 7.2 | Test long-press menu overlay in dark mode | Backdrop + panel |
| 7.3 | Test context menu in dark mode | Desktop right-click menu |
| 7.4 | Test composer contexts in dark mode | Reply/Edit/Comment banners |
| 7.5 | Test system notification chips in dark mode | Join/created messages |

---

### 32.7 Summary: Before vs After

| Metric | Before (Current) | After (All Phases) |
|---|---|---|
| Hardcoded colors | **35+** | **0** |
| Non-Lucide icon imports | **28 files** | **0** |
| Focus states | **0** | **All interactive** |
| ScrollArea usage | **0** | **All scrollable** (except virtual list) |
| Arbitrary radii | **5+** | **0** |
| Dark mode violations | **18+ components** | **0** |
| Touch target violations | **4 components** | **0** |
| Duplicate menu definitions | **2 × 160 lines** | **1 shared hook** |
| Duplicate context banners | **3 × 40 lines** | **1 shared component** |
| Message skeleton | **None** | **Proper skeleton pattern** |
| Empty state | **Blank div** | **Icon + text + CTA** |
| ARIA coverage | **~15%** | **~95%** |
| **Overall DS Score** | **3.8 / 10** | **8.5 / 10** |

**Total estimated effort: 10-14 engineering days across all 7 phases**

**Risk: LOW** — All changes are visual/cosmetic. Zero behavior changes. Can be rolled out phase by phase with screenshot-based QA.

---

### 32.8 PM Recommendations

1. **Phase 1 is non-negotiable before any public release** — hardcoded colors in dark mode will be immediately visible to users.

2. **Phase 2 (icon migration) should be batched in a single PR** — changing icons one-by-one creates visual inconsistency during the transition.

3. **Phase 4 (accessibility) is legally required** — WCAG 2.1 AA compliance is a liability issue, not a nice-to-have.

4. **Phase 6 items (DRY refactors) should be bundled with the §31 compound component restructure** — they overlap significantly with the architecture migration.

5. **Create a "Design System Lint" CI check** — use `eslint-plugin-tailwindcss` with a deny-list for `slate-*`, `zinc-*`, `gray-*`, `bg-white`, `text-black`, and non-`Lu*` icon imports to prevent regression.

---

> 📋 **Design Review Checklist (Updated):**
> - [ ] Zero Tailwind palette colors (`slate-*`, `zinc-*`, `gray-*`, `white`, `black`)
> - [ ] All icons from `react-icons/lu` (Lucide)
> - [ ] Radius tokens only (`rounded-box`, `rounded-field`, `rounded-selector`, `rounded-full`)
> - [ ] `ScrollArea` for all scrollable regions (except virtual lists / TipTap)
> - [ ] `focus-visible` ring on all interactive elements
> - [ ] `aria-label` on all icon-only buttons
> - [ ] Minimum 44×44px touch targets on mobile
> - [ ] No `rgba()` in inline styles — use CSS variables
> - [ ] No hardcoded hex in SCSS — use `oklch(var(--*))` theme variables
> - [ ] Verified in dark mode with `docsplus-dark` theme

---

## 33. Technical Writing & Document Quality Audit

> **Audit by:** Head of Technical Writing + Technical Writers Team
> **Consulting:** Head of Engineering, Staff Engineers, PM Team
> **Scope:** The `Chatroom_Feature_Review.md` document itself — structure, consistency, accuracy, and production-readiness as a living engineering reference
> **Date:** 2026-02-12

---

### 33.1 Executive Summary

This document is an **exceptional engineering artifact** — 3,696 lines covering database schema through UI pixel audits. It is the most comprehensive feature review we have seen in this codebase. However, the document was built **incrementally** across 7 audit sessions within a single day, and the seams show. There are structural fractures, contradictions between early and late sections, redundant issue tracking, and four competing roadmaps that a reader cannot reconcile without deep familiarity.

**The document is not production-ready as a living engineering reference.** An engineer reading §22 will believe border radius is compliant (✅), then reach §32.2.5 and find it's not. A PM reading §25 will plan Phase 3 for "Security," then read §28 and find Phase 1 is "Security" — different numbering, different tasks, different timelines. A new hire will find the same bug (RLS disabled) mentioned in four different sections with different severity labels.

#### Document Quality Scorecard

| Dimension | Score | Industry Standard | Gap |
|---|---|---|---|
| Table of Contents accuracy | **3/10** | Reflects all sections, linked | 🔴 ToC covers §1-25 only; §26-32 (54% of content) missing |
| Structural coherence | **4/10** | Logical flow, no orphaned sections | 🔴 "Closing Notes" at line 1538 appear mid-document |
| Cross-reference consistency | **5/10** | Unique IDs, no conflicts | 🟡 Task ID namespaces collide (T1-T15 vs T-01 to T-26) |
| Contradictions | **4/10** | Zero factual contradictions | 🔴 5 direct contradictions between sections |
| Redundancy | **3/10** | Single source of truth per issue | 🔴 Core issues repeated in 3-4 sections |
| Terminology consistency | **6/10** | Consistent naming conventions | 🟡 Mixed severity labels, underflagged code typos |
| Content completeness | **6/10** | All engineering domains covered | 🟡 No testing, CI/CD, monitoring, or glossary |
| Tone consistency | **7/10** | Unified voice throughout | 🟢 Natural shift from docs→audit; acceptable |
| Formatting consistency | **7/10** | Uniform tables, headers, markers | 🟢 Minor inconsistencies in severity indicators |
| Actionability | **5/10** | Clear, non-overlapping action items | 🔴 4 competing roadmaps with different phase numbers |

**Overall Document Quality: 5.0 / 10**

---

### 33.2 🔴 CRITICAL — Structural Issues

#### STRUCT-01: Table of Contents Is Stale (Covers Only 43% of Content)

The Table of Contents (lines 11-37) lists **25 sections** but the document now has **32 sections**. Sections 26-32 — which contain the deepest, most actionable audit findings — are completely missing from the ToC. A reader scanning the ToC would never know that trade-off analysis (§30), compound component audit (§31), or design system compliance (§32) exist.

**Missing from ToC:**

| Section | Title | Lines |
|---|---|---|
| 26 | Backend SQL Scripts — Full Inventory & Cross-Reference | 1199-1536 |
| 27 | DRY / SOLID / KISS — Production Readiness Audit | 1551-1909 |
| 28 | Production Readiness Roadmap | 1997-2062 |
| 29 | Metrics & Definition of Done | 2064-2090 |
| 30 | Staff Engineering Trade-Off Analysis | 2092-2441 |
| 31 | Compound Component Pattern — Deep Architecture Audit | 2443-3100 |
| 32 | UI/UX Design System Compliance Audit | 3118-3695 |

**That's 2,497 lines (67% of total) with no ToC entry.**

#### STRUCT-02: "Closing Notes" Appear Mid-Document (Line 1538)

The "Closing Notes" section (line 1538) was written when §25 was the final section. It says "This document provides a comprehensive map of the entire chat feature" and "Update this document with every significant change." But seven more sections follow it. A reader encountering "Closing Notes" will assume the document ends there and miss 2,158 lines of critical audit content.

**Fix:** Move "Closing Notes" to the very end of the document, or rename it to "Original Scope Notes" with a forward reference: *"For audit findings, see §26-33."*

#### STRUCT-03: No Revision History

The header says `Version: v1.0.0` but the document was built across 7+ audit passes within one day:

1. Initial documentation (§1-25) — descriptive feature docs
2. Backend cross-reference (§26) — SQL audit
3. DRY/SOLID/KISS audit (§27-29) — code quality
4. Trade-off analysis (§30) — architectural review
5. Compound component audit (§31) — pattern review
6. Design system compliance (§32) — UI/UX audit
7. Technical writing audit (§33) — this section

Each pass added substantial content and sometimes **contradicted** earlier sections. Without a revision history, there's no way to know when a section was written or whether it reflects the latest understanding.

**Fix:** Add a revision history table in the header:

```markdown
| Version | Date | Author | Sections Changed | Summary |
|---|---|---|---|---|
| v1.0.0 | 2026-02-12 | Engineering Team | §1-25 | Initial feature documentation |
| v1.1.0 | 2026-02-12 | Supabase Core Team | §26 | Backend SQL cross-reference |
| v1.2.0 | 2026-02-12 | Staff Engineers | §27-29 | DRY/SOLID/KISS audit |
| v1.3.0 | 2026-02-12 | Staff Engineers | §30 | Trade-off analysis |
| v1.4.0 | 2026-02-12 | Frontend Architecture | §31 | Compound component audit |
| v1.5.0 | 2026-02-12 | UI/UX + PM | §32 | Design system compliance |
| v1.6.0 | 2026-02-12 | Technical Writing | §33 | Document quality audit |
```

#### STRUCT-04: No Glossary

At 3,700+ lines, this document uses 50+ domain-specific terms (pgmq, SECURITY DEFINER, WAL, CDC, SRP, ISP, OCP, DIP, YAGNI, Tanstack Virtual, Dexie, TipTap, IndexedDB, realtime, broadcast, presence, sentinel, virtualizer, compound component, barrel export, etc.). A new engineer would need to look up many of these externally.

**Fix:** Add a glossary section (§A. Appendix: Glossary) at the end.

---

### 33.3 🔴 CRITICAL — Contradictions

Five factual contradictions exist between sections written at different times:

#### CONTRA-01: Design System Version Mismatch

| Location | States |
|---|---|
| Header (line 6) | `Design System Reference: Design_System_Global_v2.md v2.7.0` |
| §32.1 (line 3121) | `Reference: Notes/Design_System_Global_v2.md v3.0.0` |

The header says v2.7.0; the design audit says v3.0.0. Which version was the design system when each section was written? A reader cannot determine the canonical version.

**Fix:** Update the header to match the latest version (v3.0.0, or whatever the current version is).

#### CONTRA-02: §22 vs §32 — Border Radius Assessment

| §22 (line 973) | §32.2.5 (line 3286) |
|---|---|
| "Border radius tokens: ✅" | `rounded-3xl`, `rounded-lg`, `rounded-md` violations found in 5+ components |

§22 gives border radius a green checkmark; §32 identifies concrete violations. The ✅ in §22 is factually wrong.

#### CONTRA-03: §22 vs §32 — Accessibility Assessment

| §22 (line 978) | §32.2.3 (line 3246) |
|---|---|
| "Accessibility (ARIA): ⚠️ Some aria-labels present" | "ZERO `focus:`, `focus-visible:`, or `focus-within:` classes — WCAG 2.1 AA failure (2.4.7 Focus Visible)" |

The ⚠️ warning in §22 is a severe understatement. §32 rates accessibility at 3/10 with zero focus states across the entire chatroom. The reader who stops at §22 will believe accessibility is a minor issue.

#### CONTRA-04: §25 vs §28 — Phase Priorities Conflict

| §25 Phase Order | §28 Phase Order |
|---|---|
| Phase 1: Design System & Dark Mode (High) | Phase 1: Security & Critical Bugs (Week 1) |
| Phase 2: Type Safety (High) | Phase 2: Type Safety (Week 2) |
| Phase 3: **Security (Critical)** | Phase 3: DRY Refactoring (Weeks 3-4) |

§25 puts Design System first and Security in Phase 3 labeled "Critical." §28 correctly puts Security in Phase 1. If a PM reads §25, they'll start on color tokens. If they read §28, they'll start on RLS. These are contradictory priority orderings.

#### CONTRA-05: `pannelHeight` — Documented Without Flagging the Error

| §7 (line 431) | §27.4 (line 1900) |
|---|---|
| `pannelHeight: number // Desktop panel height (px)` — presented as correct API | `pannelHeight → should be panelHeight` — flagged as spelling error |
| §10 (line 592): "stored in `chatRoom.pannelHeight`" — presented as correct | — |

§7 and §10 document `pannelHeight` as if it's the correct property name. A developer reading §7 to understand the store shape will code against `pannelHeight` thinking it's intentional. Only if they reach §27.4 (1,500 lines later) will they learn it's a typo. The same applies to `readed_at` (line 235) — a grammatically incorrect column name (`read_at` or `last_read_at` would be correct) that is never flagged anywhere in the document.

---

### 33.4 🔴 CRITICAL — Redundancy & Duplication

The same issues are flagged in multiple sections, each with different IDs, different severity labels, and different levels of detail. This violates the **Single Source of Truth** principle for documentation.

#### REDUP-01: Issues Repeated 3+ Times

| Issue | §24 | §26 | §27 | §30 | §31 | §32 |
|---|---|---|---|---|---|---|
| RLS disabled | T2 | BUG 3 | — | §30.12 | — | — |
| Hardcoded colors | T1 | — | — | — | — | §32.2.1 |
| `any` types | T3 | — | §27.1 | — | — | — |
| Spelling errors | T4, T11 | — | KISS-05 | — | §31.5 | — |
| ChannelProvider dead | T7, T14 | — | KISS-04 | §30.14 | §31.5 | — |
| Mixed icon libraries | T5 | — | — | — | — | §32.2.2 |
| MessageComposer God Component | T13 (partial) | — | SOLID-02 | — | §31.5 | — |
| DOM-based cursor | T10 | — | KISS-01 | §30.4 | — | — |
| Fake message race | T13 (partial) | — | KISS-03 | §30.5 | — | — |

**Impact:** When a developer is assigned "fix RLS," they must check §24, §26.7, and §30.12 to understand the full scope. If they only read §24 T2, they get a one-liner. If they read §26.7 BUG 3, they get the detailed analysis. There's no indication of which is canonical.

#### REDUP-02: §22 Is Now Fully Superseded by §32

§22 "Design System Compliance" (lines 966-1004) was a preliminary audit. §32 (lines 3118-3695) is a comprehensive, component-by-component audit that covers everything §22 does and more. §22 is now **actively misleading** because it gives ✅ marks to items that §32 proves are non-compliant.

**Fix:** Replace §22 body with: *"See §32 for the comprehensive UI/UX Design System Compliance Audit. This section originally contained a preliminary assessment that has been superseded."*

#### REDUP-03: §25 Is Superseded by §28

§25 "Roadmap & Recommendations" (lines 1153-1196) was the original roadmap. §28 "Production Readiness Roadmap" (lines 1997-2062) is a detailed, task-ID-tagged roadmap with effort estimates and week assignments. §25 has 6 phases with `- [ ]` checkboxes; §28 has 6 phases with `Task ID`, `Priority`, and `Effort` columns.

**Fix:** Replace §25 body with a forward reference: *"See §28 for the detailed production readiness roadmap with task IDs, priorities, and effort estimates."*

---

### 33.5 🟡 WARNING — Conflicting Task ID Namespaces

Three separate ID schemes exist:

| Namespace | Origin Section | Range | Examples |
|---|---|---|---|
| `T1`-`T15` (no dash) | §24 Known Issues | 15 items | T1: Hardcoded colors, T2: RLS |
| `T-01`-`T-26` (with dash) | §27 DRY/SOLID/KISS | 26 items | T-01: Create type defs, T-02: Extract helper |
| `S-01`-`S-05`, `T-01`-`T-26`, `P-01`-`P-04` | §28 Roadmap | 35 items | S-01: Enable RLS, P-01: Add index |

**Collision:** `T-01` in §28 refers to "Create shared chat type definitions" but `T1` in §24 refers to "Hardcoded colors break dark mode." These are completely different issues. A developer assigned "T-01" must ask: "which T-01?"

Additionally, §31.9 uses phase-numbered tasks (Phase 1 through 10) with no IDs, and §32.6 uses section-numbered tasks (1.1 through 7.5) with yet another scheme.

**Fix:** Adopt a single, prefixed ID scheme across the entire document:

| Prefix | Domain | Example |
|---|---|---|
| `SEC-` | Security | SEC-01: Enable RLS |
| `TYPE-` | Type Safety | TYPE-01: Create shared type defs |
| `DRY-` | DRY Refactoring | DRY-01: Extract getChannelMessages |
| `ARCH-` | Architecture/SOLID | ARCH-01: Split ChatroomProvider |
| `KISS-` | KISS Simplification | KISS-01: Replace DOM cursor |
| `DS-` | Design System | DS-01: Replace hardcoded colors |
| `A11Y-` | Accessibility | A11Y-01: Add focus states |
| `PERF-` | Performance | PERF-01: Add reply_to index |
| `DX-` | Developer Experience | DX-01: Fix spelling errors |

Then use these IDs consistently in every roadmap reference.

---

### 33.6 🟡 WARNING — Four Competing Roadmaps

| Roadmap | Section | Phases | Scope | Has Task IDs? | Has Time Estimates? |
|---|---|---|---|---|---|
| **Roadmap A** | §25 | 6 phases | General recommendations | ❌ | ❌ |
| **Roadmap B** | §28 | 6 phases (weekly) | DRY/SOLID/KISS + Security | ✅ (T-xx, S-xx, P-xx) | ✅ (Week 1-8) |
| **Roadmap C** | §31.9 | 10 phases | Compound component restructure | ❌ | ❌ |
| **Roadmap D** | §32.6 | 7 phases | Design system compliance | ❌ (section-numbered) | ✅ (day estimates) |

A project manager trying to build a sprint plan would need to:
1. Read all 4 roadmaps
2. Manually deduplicate overlapping tasks (e.g., "fix hardcoded colors" appears in A, B, and D)
3. Resolve priority conflicts (A says Design first, B says Security first)
4. Merge into a single execution plan

**Fix:** Create a **§34. Unified Execution Roadmap** (or an Appendix) that:
- Assigns a single canonical ID to every task
- Groups by execution sprint (not by audit origin)
- Marks which audit section(s) originated each task
- Provides a single priority ordering
- Includes total effort estimates

This should be the **only** roadmap referenced in sprint planning. The section-specific roadmaps (§25, §28, §31.9, §32.6) should add a note: *"For sprint planning, see the Unified Roadmap in §34."*

---

### 33.7 🟡 WARNING — Terminology & Severity Inconsistency

#### TERM-01: Severity Labels

Four different severity schemes are used:

| Section | Red | Yellow | Green | Other |
|---|---|---|---|---|
| §24 | 🔴 Critical | 🟡 Medium | 🟢 Low | — |
| §26 | 🔴 (in headers) | 🟡 (in headers) | — | — |
| §27 | 🔴 CRITICAL | 🟡 (implied) | — | — |
| §30.15 | 🔴 Security/Race | 🟡 Perf/DOM | 🟢 Low | — |
| §32 | 🔴 CRITICAL | 🟡 WARNING | 🟢 GOOD | ⚠️ NOTICE |

**Fix:** Define a single severity key in the header or a glossary section:

| Indicator | Label | Meaning | Action Required |
|---|---|---|---|
| 🔴 | CRITICAL | Blocks production launch or causes data loss/security breach | Must fix before any public release |
| 🟠 | HIGH | Significant quality or UX issue | Fix within 2 sprints |
| 🟡 | MEDIUM | Technical debt or inconsistency | Fix within 1 quarter |
| 🟢 | LOW | Nice-to-have or cosmetic | Backlog |
| ✅ | COMPLIANT | Meets or exceeds industry standard | No action needed |
| ⚠️ | NOTICE | Informational — monitor but no immediate action | — |

#### TERM-02: "Compound Component" vs "Compound Pattern"

The document alternates between "compound component pattern," "compound components," and "compound pattern." While these are understood synonyms, a technical document should pick one canonical term and use it consistently.

#### TERM-03: Underflagged Code-Level Naming Errors

The document accurately reflects code-level typos (like `pannelHeight`, `readed_at`, `contextMenue`) in §7, §3.2, and §11, but only flags them as bugs in §27.4 (1,500+ lines later). A reader in §7 sees `pannelHeight` and has no inline indication that it's a known error. Similarly, `readed_at` in the `messages` table (§3.2, line 235) is a grammatical error in an actual database column name — it should be `read_at` or `last_read_at` — but it is **never flagged anywhere** in the document as an issue.

**Fix:** In descriptive sections (§3, §7, §10, §11), add an inline annotation for known naming issues:

```markdown
| `pannelHeight` | `number` | Desktop panel height (px) | ⚠️ Typo — should be `panelHeight` (see §27.4 KISS-05) |
```

---

### 33.8 🟡 WARNING — Content Gaps

Six engineering domains are absent from this document:

| Missing Domain | Why It Matters | Recommended Section |
|---|---|---|
| **Test Coverage & Strategy** | No mention of unit tests, integration tests, E2E tests, or coverage metrics for any chatroom code. A production-ready document must state what is tested and what isn't. | §35. Testing Strategy |
| **CI/CD & Deployment** | No mention of how chatroom changes are deployed, what CI checks exist, whether database migrations are automated, or how rollbacks work. | §36. Deployment & CI |
| **Error Monitoring & Alerting** | No mention of Sentry, LogRocket, or any error tracking. §30.13 identifies "silent failures" but doesn't prescribe monitoring. | Append to §30.13 |
| **Performance Benchmarks** | §14 describes the virtualization architecture but provides zero actual metrics — no FPS measurements, no time-to-interactive, no message-load latency, no Lighthouse scores. | §37. Performance Benchmarks |
| **API Consumer Documentation** | The document describes internal implementations but not the **contract** for page-level consumers. How does `DesktopEditor.tsx` know what props to pass? What's the minimum viable chatroom setup? | §38. Consumer Integration Guide |
| **Data Migration Plan** | §30.10 recommends migrating reactions from JSONB to a junction table. §31 recommends restructuring 60 files. Neither section addresses data migration (existing reactions, existing database rows). | Append to §28 or §30.10 |

---

### 33.9 🟢 GOOD — What the Document Gets Right

Despite the issues above, this document demonstrates several technical writing best practices:

| Strength | Where |
|---|---|
| **ASCII architecture diagrams** | §2 (line 83), §10 (line 606), §14 (line 766) — clear, text-based diagrams that render in any markdown viewer |
| **Comparison tables for trade-offs** | §30 throughout — every decision has a structured "What we gained / What we gave up / Risk / Alternative / Verdict" analysis |
| **Concrete code examples** | §27 provides before/after code for every violation — not just descriptions, but actual fixable code |
| **Cross-section references** | §28 references §26.7, §32 references §31 — creates a navigable web of knowledge |
| **Compliance matrices** | §32.3 component-by-component matrix — exhaustive and actionable |
| **Executive summaries** | §30, §31, §32 all open with summary scorecards before diving into details |
| **Quantified metrics** | "35+ hardcoded violations," "57 sub-component exports," "8-level deep chains" — specific, not vague |
| **Recommended replacements** | §32.2.2 provides exact Lucide equivalents for every non-Lucide icon — copy-paste ready |
| **Risk ratings** | §31.9 migration roadmap includes risk per phase (🟢🟡) |
| **Consistent table structure** | Most audit tables follow `| What | Where | Fix |` pattern — scannable and uniform |

---

### 33.10 Formatting & Style Audit

#### FMT-01: Inconsistent API File Path Precision

In §6 API Layer tables (lines 378-400), some entries have precise file paths:

```
| `sendMessage()`  | `api/messages/sendMessage.ts`  | Insert message |
```

But others use vague placeholders:

```
| `updateMessage()` | `api/messages/` (implied)  | Update message content |
| `markReadMessages()` | `api/` (implied)  | Mark messages as read |
```

"(implied)" provides zero information. Either the file exists and should be named, or it doesn't and should be marked `❌ Not found`.

#### FMT-02: LOC Estimates in §23 Are Approximate

The File Inventory (§23) uses `~` for many LOC values (`~20`, `~30`, `~40`, `~60`, `~80`). This reduces the value of the inventory — a reader cannot distinguish a 20-line component from a 40-line one. Since the files were read during the audit, exact LOC should be provided.

#### FMT-03: Two Review Checklists at Different Points

Two `📋 Review Checklist` blocks exist:
1. Line 3104 — original checklist (10 items)
2. Line 3684 — updated design review checklist (10 items, different items)

These are complementary, not redundant, but their placement is confusing. The first is after §31 (compound component audit), the second after §32 (design audit). A developer doing a code review would need to check both, scattered 580 lines apart.

**Fix:** Merge into one unified checklist at the end of the document.

---

### 33.11 Document Production-Readiness Verdict

| Criterion | Current | Industry Standard | Ready? |
|---|---|---|---|
| Table of Contents complete | ❌ 43% coverage | 100% | 🔴 No |
| Zero contradictions | ❌ 5 contradictions | 0 | 🔴 No |
| Single source of truth per issue | ❌ 3-4× repetition | 1× | 🔴 No |
| Unified task ID system | ❌ 3 conflicting schemes | 1 scheme | 🔴 No |
| Single canonical roadmap | ❌ 4 competing roadmaps | 1 roadmap | 🔴 No |
| Revision history | ❌ None | Present | 🟡 No |
| All code-level errors flagged inline | ❌ Some hidden | All flagged | 🟡 No |
| Testing coverage section | ❌ Missing | Present | 🟡 No |
| CI/CD section | ❌ Missing | Present | 🟡 No |
| Glossary | ❌ Missing | Present for 3K+ line docs | 🟡 No |
| Consistent severity labels | ❌ 4 schemes | 1 scheme | 🟡 No |
| Formatting consistency | ✅ Mostly uniform | Uniform | 🟢 Yes |
| Executive summaries | ✅ Present | Present | 🟢 Yes |
| Code examples | ✅ Concrete | Concrete | 🟢 Yes |
| Cross-references | ✅ Present (§xx) | Present | 🟢 Yes |

**Verdict: The content is production-grade. The document structure is not.**

The information in this document is exceptionally thorough, technically accurate, and actionable. But the incremental authoring process left structural debt that makes the document unreliable as a single source of truth. Fixing the structure is a **1-day effort** with zero risk.

---

### 33.12 Prioritized Fix Roadmap

#### Phase 1 — Structural Integrity (2-4 hours) 🔴

| # | Task | Impact |
|---|---|---|
| 1.1 | Update Table of Contents to include §26-33 with anchor links | Readers can navigate the full document |
| 1.2 | Move "Closing Notes" (line 1538) to end of document | Eliminates mid-document false ending |
| 1.3 | Fix Design System version: header line 6 → match §32 (v3.0.0 or current) | Resolves CONTRA-01 |
| 1.4 | Add superseded note to §22 body → "See §32 for comprehensive audit" | Resolves CONTRA-02, CONTRA-03, REDUP-02 |
| 1.5 | Add superseded note to §25 body → "See §28 for detailed roadmap" | Resolves CONTRA-04, REDUP-03 |
| 1.6 | Merge the two `📋 Review Checklist` blocks into one at end of document | Single checklist |

#### Phase 2 — ID & Roadmap Unification (4-6 hours) 🟠

| # | Task | Impact |
|---|---|---|
| 2.1 | Define canonical task ID scheme (SEC-, TYPE-, DRY-, ARCH-, DS-, A11Y-, PERF-, DX-) | Resolves all ID conflicts |
| 2.2 | Re-ID all tasks in §24, §27, §28, §31.9, §32.6 to use the new scheme | Single lookup per task |
| 2.3 | Create §34 "Unified Execution Roadmap" consolidating all 4 roadmaps | Single sprint planning source |
| 2.4 | Add "For sprint planning, see §34" notes to §25, §28, §31.9, §32.6 | Eliminates roadmap confusion |

#### Phase 3 — Consistency & Completeness (2-4 hours) 🟡

| # | Task | Impact |
|---|---|---|
| 3.1 | Add severity key definition to header or §A (Appendix) | All sections use same labels |
| 3.2 | Add revision history table to header | Track document evolution |
| 3.3 | Add inline `⚠️ Typo` annotations in §3.2, §7, §10, §11 for known naming errors | Eliminates hidden traps |
| 3.4 | Flag `readed_at` (§3.2 line 235) as a known issue — grammatically incorrect column name | New issue captured |
| 3.5 | Replace "(implied)" in §6 API tables with actual file paths or `❌ Not found` | Precise references |
| 3.6 | Update approximate LOC in §23 with exact counts | Precise inventory |

#### Phase 4 — Missing Sections (1-2 days) 🔵

| # | Task | Impact |
|---|---|---|
| 4.1 | Add §35 "Testing Strategy" — coverage, gaps, recommended framework | Complete engineering picture |
| 4.2 | Add §36 "Deployment & CI" — migration process, CI checks, rollback plan | Operational readiness |
| 4.3 | Add §37 "Performance Benchmarks" — target KPIs, measurement methodology | Quantified performance goals |
| 4.4 | Add §A "Appendix: Glossary" — 50+ terms defined | Onboarding support |
| 4.5 | Add data migration plan for JSONB reactions → junction table (append to §30.10) | Migration completeness |

---

### 33.13 Summary: Before vs After

| Metric | Before (Current) | After (All Phases) |
|---|---|---|
| ToC coverage | **43%** (25/32 sections) | **100%** (all sections) |
| Contradictions | **5** | **0** |
| Redundant issue locations | **3-4× per issue** | **1× (canonical) + cross-refs** |
| Task ID schemes | **3 conflicting** | **1 unified** |
| Competing roadmaps | **4** | **1 unified + section-specific details** |
| Severity label schemes | **4** | **1 defined** |
| Missing engineering sections | **5** (testing, CI, perf, glossary, migration) | **0** |
| "Closing Notes" position | **Mid-document** (line 1538) | **End of document** |
| Known typos flagged inline | **Partial** | **All flagged with ⚠️** |
| Revision history | **None** | **Present** |
| **Document Quality Score** | **5.0 / 10** | **8.5 / 10** |

**Total estimated effort: 2-3 days for Phases 1-3, 1-2 additional days for Phase 4.**

**Risk: ZERO** — All changes are documentation-only. No code changes. No behavior changes. Can be done by any team member.

---

### 33.14 Key Takeaway

> **"A 3,700-line document with 5 contradictions is worse than a 500-line document with zero."**

The depth and quality of individual sections (especially §30, §31, §32) are outstanding — genuinely staff-engineer-level analysis. But the document's value as a **living reference** is undermined by its incremental construction. A reader who trusts §22's ✅ marks will make wrong decisions. A PM who builds a sprint from §25's phases will prioritize incorrectly.

The fix is straightforward: deduplicate, unify IDs, consolidate roadmaps, and add forward/backward references. This transforms the document from "7 excellent audits stitched together" into "one cohesive engineering bible."

**After Phase 1-3 fixes, this document would be the best feature-level engineering reference we've ever seen.**

