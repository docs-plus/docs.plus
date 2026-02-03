# docs.plus Backend API Documentation

> **Base URL:** `http://localhost:4000`
> **Version:** 2.0.0-beta
> **Last Updated:** January 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Health Endpoints](#health-endpoints)
4. [Documents API](#documents-api)
5. [Media API](#media-api)
6. [Email API](#email-api)
7. [Push Notifications](#push-notifications)
8. [Admin API](#admin-api)
9. [Error Handling](#error-handling)

---

## Overview

The docs.plus backend consists of three services:

| Service       | Port | Purpose                                   |
| ------------- | ---- | ----------------------------------------- |
| **REST API**  | 4000 | HTTP endpoints for CRUD operations        |
| **WebSocket** | 4001 | Real-time collaboration (Hocuspocus/Y.js) |
| **Worker**    | 4002 | Background jobs (BullMQ)                  |

### Tech Stack

- **Framework:** Hono (fast, lightweight)
- **Validation:** Zod schemas
- **Database:** PostgreSQL via Prisma
- **Queue:** BullMQ + Redis
- **Auth:** JWT + Supabase

---

## Authentication

Most endpoints require authentication via JWT token in the Authorization header:

```http
Authorization: Bearer <jwt_token>
```

### Service Role (Internal)

Internal endpoints (email, push) require the Supabase service role key:

```http
Authorization: Bearer <supabase_service_role_key>
```

---

## Health Endpoints

Check service health and dependencies.

### GET /health

Overall health check for all dependencies.

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2026-01-30T12:00:00.000Z",
  "services": {
    "database": { "status": "healthy", "latency": 5 },
    "redis": { "status": "healthy", "latency": 2 },
    "supabase": { "status": "healthy", "latency": 15 }
  }
}
```

### GET /health/database

Database connection health.

### GET /health/redis

Redis connection health.

### GET /health/supabase

Supabase connection health.

---

## Documents API

Base path: `/api/documents`

### GET /api/documents

List documents with optional search.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `search` | string | Search term for document title/content |
| `limit` | number | Max results (default: 20) |
| `offset` | number | Pagination offset |
| `userId` | string | Filter by owner |

**Response:**

```json
{
  "documents": [
    {
      "id": "uuid",
      "slug": "my-document",
      "title": "My Document",
      "isPrivate": false,
      "createdAt": "2026-01-30T12:00:00.000Z",
      "updatedAt": "2026-01-30T12:00:00.000Z"
    }
  ],
  "total": 100
}
```

### GET /api/documents/:docName

Get a single document by slug.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `userId` | string | User ID for access control |

**Response:**

```json
{
  "id": "uuid",
  "slug": "my-document",
  "title": "My Document",
  "content": "...",
  "isPrivate": false,
  "ownerId": "user-uuid",
  "createdAt": "2026-01-30T12:00:00.000Z"
}
```

### POST /api/documents

Create a new document.

**Request Body:**

```json
{
  "title": "My New Document",
  "slug": "my-new-document",
  "isPrivate": false,
  "workspaceId": "workspace-uuid"
}
```

**Response:** `201 Created`

```json
{
  "id": "uuid",
  "slug": "my-new-document",
  "title": "My New Document"
}
```

### PUT /api/documents/:docId

Update document metadata.

**Request Body:**

```json
{
  "title": "Updated Title",
  "isPrivate": true
}
```

**Response:** `200 OK`

---

## Media API

Base path: `/api/plugins/hypermultimedia`

Handles media uploads for the TipTap editor.

### POST /api/plugins/hypermultimedia/:documentId

Upload a media file to a document.

**Request:** `multipart/form-data`
| Field | Type | Description |
|-------|------|-------------|
| `file` | File | The media file to upload |

**Response:**

```json
{
  "id": "media-uuid",
  "url": "https://storage.example.com/media/...",
  "mimeType": "image/png",
  "size": 12345
}
```

### GET /api/plugins/hypermultimedia/:documentId/:mediaId

Retrieve a media file.

**Response:** Binary file with appropriate `Content-Type` header.

---

## Email API

Base path: `/api/email`

> **Architecture Change:** Email notifications now use **pgmq Consumer** architecture.
> The `/api/email/send` HTTP endpoint has been removed.

Email notifications are triggered directly from Supabase via database triggers:

1. Notification created → `email_queue` table populated
2. `pg_cron` moves due emails to pgmq queue
3. `hocuspocus-worker` polls queue and processes via BullMQ
4. SMTP provider sends email

**See:** `docs/PUSH_NOTIFICATION_PGMQ.md` for architecture details (same pattern).

### POST /api/email/send-generic

Send a generic email (internal use).

**Request Body:**

```json
{
  "to": "user@example.com",
  "subject": "Email Subject",
  "html": "<html>...</html>"
}
```

### POST /api/email/send-digest

Send daily/weekly digest emails.

**Request Body:**

```json
{
  "to": "user@example.com",
  "frequency": "daily",
  "documents": [
    { "title": "Doc 1", "updates": 5 },
    { "title": "Doc 2", "updates": 3 }
  ]
}
```

### GET /api/email/health

Get email gateway health status.

### GET /api/email/status

Check if email service is operational.

### GET /api/email/unsubscribe?token=xxx

Process one-click unsubscribe from email links. Returns HTML page.

### POST /api/email/unsubscribe?token=xxx

RFC 8058 List-Unsubscribe-Post handler for email clients.

---

## Push Notifications

> **Architecture Change:** Push notifications now use **pgmq Consumer** architecture.
> The `/api/push` HTTP endpoint has been removed.

Push notifications are triggered directly from Supabase via database triggers:

1. Notification created → Trigger enqueues to `pgmq` queue
2. `hocuspocus-worker` polls queue and processes via BullMQ
3. Web Push API sends to user devices

**See:** `docs/PUSH_NOTIFICATION_PGMQ.md` for full architecture details.

### Client-Side Subscription

Use the Supabase RPC functions to manage push subscriptions:

```javascript
// Register device
await supabase.rpc('register_push_subscription', {
  p_device_id: 'unique-device-id',
  p_device_name: 'Chrome on MacBook',
  p_platform: 'web',
  p_push_credentials: { endpoint: '...', keys: { p256dh: '...', auth: '...' } }
})

// Unregister
await supabase.rpc('unregister_push_subscription', {
  p_device_id: 'unique-device-id'
})
```

---

## Admin API

Base path: `/api/admin`

**Note:** Requires admin authentication (user must be in `admin_users` table).

### Dashboard

#### GET /api/admin/stats

Get dashboard overview statistics.

**Response:**

```json
{
  "users": { "total": 1000, "active": 500, "new_today": 10 },
  "documents": { "total": 5000, "public": 3000, "private": 2000 },
  "messages": { "total": 50000, "today": 500 }
}
```

### Documents Management

#### GET /api/admin/documents

List all documents with pagination.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20) |
| `search` | string | Search term |
| `sort` | string | Sort field |

#### GET /api/admin/documents/stats

Get document statistics.

#### PATCH /api/admin/documents/:id

Update document flags (featured, archived, etc.).

#### GET /api/admin/documents/:id/deletion-impact

Preview what will be deleted if document is removed.

#### DELETE /api/admin/documents/:id

Delete a document (requires `confirmSlug` in body).

### User Management

#### GET /api/admin/users/document-counts

Get document count per user for the Users page.

### Analytics

#### GET /api/admin/stats/views

Get overall view statistics summary.

#### GET /api/admin/stats/views/top

Get top viewed documents.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `limit` | number | Number of results (default: 10) |
| `period` | string | Time period: `day`, `week`, `month` |

#### GET /api/admin/stats/views/trend

Get view trends for charts.

#### GET /api/admin/documents/:slug/views

Get view stats for a specific document.

### Retention Analytics

#### GET /api/admin/stats/retention

Get DAU/WAU/MAU retention metrics.

#### GET /api/admin/stats/user-lifecycle

Get user lifecycle segments (new, returning, dormant, churned).

#### GET /api/admin/stats/dau-trend

Get daily active users trend.

#### GET /api/admin/stats/activity-heatmap

Get activity by hour for heatmap visualization.

#### GET /api/admin/stats/top-active-documents

Get most active documents by message count.

#### GET /api/admin/stats/communication

Get communication statistics.

#### GET /api/admin/stats/notification-reach

Get notification delivery statistics.

---

## Error Handling

All errors follow a consistent format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### HTTP Status Codes

| Code  | Description                    |
| ----- | ------------------------------ |
| `200` | Success                        |
| `201` | Created                        |
| `400` | Bad Request (validation error) |
| `401` | Unauthorized                   |
| `403` | Forbidden                      |
| `404` | Not Found                      |
| `429` | Rate Limited                   |
| `500` | Internal Server Error          |

### Common Error Codes

| Code                | Description                 |
| ------------------- | --------------------------- |
| `VALIDATION_ERROR`  | Request body/params invalid |
| `AUTH_REQUIRED`     | Missing or invalid token    |
| `PERMISSION_DENIED` | User lacks access           |
| `NOT_FOUND`         | Resource doesn't exist      |
| `RATE_LIMITED`      | Too many requests           |

---

## WebSocket API

The WebSocket server (port 4001) uses the Hocuspocus protocol for real-time collaboration.

### Connection

```javascript
import { HocuspocusProvider } from '@hocuspocus/provider'

const provider = new HocuspocusProvider({
  url: 'ws://localhost:4001',
  name: 'document-slug',
  token: 'jwt-token'
})
```

### Events

| Event              | Description               |
| ------------------ | ------------------------- |
| `synced`           | Initial sync complete     |
| `status`           | Connection status changed |
| `awareness-update` | User presence changed     |

See [Hocuspocus Documentation](https://tiptap.dev/hocuspocus/introduction) for full protocol details.

---

## Rate Limiting

API endpoints are rate limited:

| Endpoint Type | Limit       |
| ------------- | ----------- |
| Public        | 100 req/min |
| Authenticated | 300 req/min |
| Admin         | 600 req/min |

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706619600
```
