# Panel feed seams

Toolbar panels (bookmarks, notifications) share UI chrome but split persistent state by domain.

## UI stack (shared)

`PanelSurfaceShell` → `TabbedPanelBody` → `PanelFeedItem` row shell. Popover header via `PanelPopoverHeader`; dismiss via `useDismissPanel`.

## Feed modules (per panel)

| Panel         | Feed hook                                         | Store home                    | Initial load policy                                         |
| ------------- | ------------------------------------------------- | ----------------------------- | ----------------------------------------------------------- |
| Bookmarks     | `bookmarkPanel/feed/useBookmarkPanelFeed`         | `useChatStore` bookmark slice | Stats RPC + first page per tab in parallel                  |
| Notifications | `notificationPanel/feed/useNotificationPanelFeed` | `useStore` notification slice | Summary seeds Unread/Mentions; Read lazy on first tab visit |

Tab→RPC mapping for bookmarks lives in `bookmarkPanel/utils/bookmarkTabQuery.ts` (consumed only by the feed module).

## Row exit animation

`hooks/useFeedItemExit` owns timer + reduced-motion exit. Panel action hooks supply domain `onStart` / `onComplete`:

- Bookmarks: `useBookmarkPanelActions` → `commitBookmark*` store intents
- Notifications: `useMarkNotificationAsRead` → decrement + `readDedupe`, then remove from list

## Bookmark mutations (intent-shaped store)

`useChatStore` bookmark slice exposes `commitBookmarkRemoved`, `commitBookmarkMarkedRead`, `commitBookmarkArchived`, `commitBookmarkRestored` — each updates in-memory lists and tab badge counts (±1 vs server stats, not loaded list length).

## Notification read dedupe

`notificationPanel/feed/readDedupe.ts` — ephemeral Set coordinating panel-initiated reads with `useNotificationCount` realtime decrements. Not Zustand state; not exported from `@stores`.

## Do not unify

Bookmark and notification stores stay separate (chat-adjacent vs workspace-wide). Do not add a generic panel registry unless a third tabbed feed panel ships.
