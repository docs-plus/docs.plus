// -----------------------------------------------------------------------------
// Service Worker Extension for Docs.plus
// Handles: User status updates, Push notifications
// Version: 2.3.0 - Imported by Workbox sw.js via importScripts
// -----------------------------------------------------------------------------

console.info("[SW Extension] Push notification handlers loaded");

// Message handler for cross-tab communication and SW updates
self.addEventListener("message", (event) => {
  const data = event.data;

  // Handle SKIP_WAITING from update hook (Workbox also handles this)
  if (data && data.type === "SKIP_WAITING") {
    console.info("[SW Extension] Received SKIP_WAITING, activating new version...");
    self.skipWaiting();
    return;
  }

  // Handle user status updates
  const payload = data?.payload;
  if (data && data.type === "UPDATE_USER_STATUS" && payload) {
    updateUser(payload);
  }
});

async function updateUser({ userId, status }) {
  if (!userId) {
    console.error("User ID is required to update user status");
    return;
  }
  if (!status) {
    console.error("User status is required to update user status");
    return;
  }

  await fetch("api/updateUserStatus", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, status }),
  })
    .then((response) => {
      if (response.ok) {
        console.info("User status updated successfully!");
      } else {
        console.error("Failed to update user status");
      }
    })
    .catch((error) => {
      console.error("Failed to update user status", error);
    });
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
    case "channel_message":
      return `${name} sent a message`;
    case "invite":
      return `${name} invited you`;
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
  if (!event.data) {
    return;
  }

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = { type: "unknown", message_preview: event.data.text() };
  }

  // Build title and body from raw data
  const title = buildNotificationTitle(data.type, data.sender_name);
  const body = buildNotificationBody(data);

  // Use sender avatar if available, otherwise fall back to app icon
  // The sender_avatar comes from the push payload (set in 19-push-notifications.sql)
  const notificationIcon = data.sender_avatar || "/icons/android-chrome-192x192.png";

  const options = {
    body: body,
    icon: notificationIcon,
    badge: "/icons/favicon-32x32.png",
    tag: data.type || "default",
    renotify: true,
    requireInteraction: false,
    data: {
      url: data.action_url || "/",
      notification_id: data.notification_id,
    },
    vibrate: [200, 100, 200],
    // Include image preview if message has an attachment
    ...(data.image_url && { image: data.image_url }),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

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
