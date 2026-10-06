// -----------------------------------------------------------------------------
// Service Worker Extension for Docs.plus
// Handles: Lifecycle (activate/claim), Share target, Push notifications
// Version: 2.4.0 - Imported by Workbox sw.js via importScripts
// -----------------------------------------------------------------------------

console.info("[SW Extension] Push notification handlers loaded");

// ── Lifecycle: claim clients on activate ──
// When a new SW activates (after SKIP_WAITING), immediately claim all
// open tabs/windows so they start using the new SW without requiring
// a manual page reload. This is critical for mobile PWA where the user
// may not close/reopen the app.
self.addEventListener("activate", (event) => {
  console.info("[SW Extension] Activating — claiming all clients…");
  event.waitUntil(self.clients.claim());
});

// Message handler for cross-tab communication and SW updates
self.addEventListener("message", (event) => {
  const data = event.data;

  // Handle SKIP_WAITING from update hook (Workbox also handles this)
  if (data && data.type === "SKIP_WAITING") {
    console.info("[SW Extension] Received SKIP_WAITING, activating new version…");
    self.skipWaiting();
    return;
  }
});

// Share target: Android posts a shared file to /receive (manifest share_target).
// A page cannot read a POST body, so the worker keeps the file in Cache Storage and
// redirects to GET /receive. Every other request falls through to Workbox untouched.
const SHARE_CACHE = "docsplus-share-target";
const SHARE_KEY = "/__docsplus/shared-file";

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "POST") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname !== "/receive") return;
  event.respondWith(stashSharedFile(request));
});

async function stashSharedFile(request) {
  const back = (query) => Response.redirect(new URL(`/receive?${query}`, self.location.origin).href, 303);
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return back("retry=1");
    const cache = await caches.open(SHARE_CACHE);
    await cache.put(
      SHARE_KEY,
      new Response(file, {
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          // Header values must be ByteStrings; a file name can hold any character.
          "X-Share-Name": encodeURIComponent(file.name),
          "X-Share-Id": `${Date.now()}`,
        },
      })
    );
    return back("shared=1");
  } catch (error) {
    console.error("[SW Extension] Could not keep the shared file", error);
    return back("retry=1");
  }
}

// -----------------------------------------------------------------------------
// Push Notification Handlers
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Notification Content Builder (Single Source of Truth)
// -----------------------------------------------------------------------------

/**
 * Build notification title based on type and sender
 * @param {string} type - Notification type (mention, reply, reaction, etc.)
 * @param {string} senderName - Display name of the sender
 * @returns {string} Human-readable notification title
 */
function buildNotificationTitle(type, senderName) {
  const name = senderName || "Someone";

  switch (type) {
    case "mention":
      return `${name} mentioned you`;
    case "reply":
      return `${name} replied to you`;
    case "reaction":
      return `${name} reacted to your message`;
    case "direct_message":
      return `Message from ${name}`;
    case "thread_message":
      return `${name} replied in thread`;
    case "message":
    case "channel_event":
    case "channel_message":
      return `${name} sent a message`;
    case "invitation":
    case "invite":
      return `${name} invited you`;
    // These two can come with no sender, so the title leaves the name out.
    case "content_change":
      return "A document you follow changed";
    case "system_alert":
      return "Account notice";
    default:
      return "New notification";
  }
}

/**
 * Build notification body/preview text
 * @param {object} data - Push notification payload
 * @returns {string} Notification body text
 */
function buildNotificationBody(data) {
  // Use message preview if available
  if (data.message_preview) {
    // Truncate long messages
    const maxLength = 100;
    if (data.message_preview.length > maxLength) {
      return data.message_preview.substring(0, maxLength) + "...";
    }
    return data.message_preview;
  }

  // Fallback based on type
  switch (data.type) {
    case "mention":
      return "You were mentioned in a conversation";
    case "reply":
      return "You have a new reply";
    case "reaction":
      return data.reaction_emoji || "👍";
    case "invite":
      return "You have a new invitation";
    default:
      return "";
  }
}

// Handle incoming push notifications
self.addEventListener("push", (event) => {
  // Chrome and Android can revoke the subscription when a push shows nothing,
  // so a bad or empty payload still shows this generic notification.
  let title = "New notification";
  let options = {
    icon: "/icons/android-chrome-192x192.png",
    badge: "/icons/favicon-32x32.png",
    data: { url: "/" },
  };

  try {
    const data = event.data ? event.data.json() : null;
    if (data && typeof data === "object") {
      title = buildNotificationTitle(data.type, data.sender_name);
      const body = buildNotificationBody(data);

      // Use sender avatar if available, otherwise fall back to app icon
      // The sender_avatar comes from the push payload (set in 19-push-notifications.sql)
      const notificationIcon = data.sender_avatar || "/icons/android-chrome-192x192.png";

      // Use notification_id as tag so each notification is unique on iOS.
      // iOS Safari does NOT support `renotify` — using a generic tag like "mention"
      // would cause each new mention to silently replace the previous one.
      const tag = data.notification_id || `${data.type}-${Date.now()}`;

      options = {
        body: body,
        icon: notificationIcon,
        badge: "/icons/favicon-32x32.png",
        tag: tag,
        renotify: true,
        requireInteraction: false,
        data: {
          url: data.action_url || "/",
          notification_id: data.notification_id,
        },
        // Include image preview if message has an attachment
        ...(data.image_url && { image: data.image_url }),
      };
    }
  } catch (error) {
    console.warn("[SW Extension] Bad push payload, showing a generic notification", error);
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

// The worker has no user session, so it cannot save the new endpoint.
// The client saves it on its next signed-in load.
self.addEventListener("pushsubscriptionchange", (event) => {
  const key = event.oldSubscription?.options?.applicationServerKey;
  if (!key) return;
  event.waitUntil(
    self.registration.pushManager
      .subscribe({ userVisibleOnly: true, applicationServerKey: key })
      .catch((error) => console.error("[SW Extension] Could not subscribe again", error))
  );
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // action_url comes from the payload, so only a same-origin path may open.
  let url = "/";
  try {
    const target = new URL(event.notification.data?.url || "/", self.location.origin);
    if (target.origin === self.location.origin) url = target.href;
  } catch {}

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            // Focus existing window and navigate
            client.focus();
            client.postMessage({
              type: "NOTIFICATION_CLICK",
              url: url,
              notification_id: event.notification.data?.notification_id,
            });
            return;
          }
        }
        // Open new window if none exists
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// Handle notification close (for analytics if needed)
self.addEventListener("notificationclose", (event) => {
  // Optional: track dismissed notifications
});
