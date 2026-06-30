# CollabCanvas

A production-grade real-time collaborative whiteboard. Multiple users can draw on a shared canvas simultaneously — changes sync instantly across all connected clients with zero conflicts, powered by CRDTs (Yjs).

Think lightweight Figma, built from scratch.

**Live:** https://collabcanvas-web.onrender.com

---

## What's working

**Auth & Workspace**
- Register / login with JWT auth (httpOnly cookie for refresh token, auto-refresh on 401)
- Password visibility toggle on login and register forms
- Dashboard — create rooms, see all your rooms as cards with live thumbnails
- Delete room (owner only) or leave room (collaborators) — role-aware, protected server-side
- When owner deletes an active room, all connected collaborators receive a real-time notification and are redirected to the dashboard
- Invite collaborators by email

**Canvas**
- Drawing tools: **rectangle**, **ellipse**, **freehand pen**, **arrow** (with filled arrowhead), **text**
- Pan the canvas: hand tool, Space + drag, or middle mouse button
- Zoom: scroll wheel toward cursor; viewport-invariant rendering via matrix transform
- Select + drag any shape to reposition it
- Resize any shape with 8 grab handles (corners + edge midpoints); arrows have 2 endpoint handles
- Text tool: textarea overlay with auto-grow, drag corner to resize and scale font proportionally
- Delete selected shape via floating button or `Delete` / `Backspace`
- Export canvas as PNG (white background, downloads instantly)
- Undo / redo — backed by Yjs UndoManager

**Real-time collaboration**
- Binary Yjs CRDT sync over WebSocket — no conflicts, ever
- Redis pub/sub fan-out for horizontal WebSocket scaling across multiple server instances
- Live cursor positions with name labels and per-user colors
- New joiner catches up instantly via full `Y.encodeStateAsUpdate` on join
- Snapshot persistence: Yjs doc saved to PostgreSQL every 50 ops and when the last user leaves; reloaded on room join so state survives server restarts
- y-indexeddb local persistence — canvas loads from IndexedDB instantly before WS sync completes

**Observability**
- `GET /metrics` — Prometheus endpoint with app-level gauges/counters + full Node.js process metrics (heap, GC, event loop lag percentiles)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 + TypeScript |
| Canvas | Canvas API (raw, no library) |
| CRDT | Yjs (Y.Doc, Y.Map, UndoManager, y-indexeddb) |
| State | Zustand |
| Forms | React Hook Form + Zod |
| Backend | Node.js + Express + TypeScript |
| WebSocket | ws library (binary Yjs protocol) |
| Pub/Sub | Redis via ioredis |
| Database | PostgreSQL + Prisma ORM |
| Metrics | prom-client (Prometheus) |
| Styling | TailwindCSS |
| Infra | Docker + docker-compose (local), Render (production) |
| Monorepo | pnpm workspaces |

---

## Architecture

```
Browser
  ├── Canvas API + RAF render loop
  ├── Yjs Y.Doc  (Y.Map<Shape> — CRDT state)
  ├── UndoManager
  ├── y-indexeddb  (local persistence)
  └── WebSocket client
        │  binary Yjs updates (draw ops)
        │  JSON control messages (join/leave/cursor/room_deleted)
        ▼
  Express API  (JWT auth, rate limiting, room CRUD)
  WebSocket Server  (same port — HTTP upgrade)
        │
        ├── server-side Y.Doc per room
        │     accumulates updates → sent to new joiners on join
        │     periodic + on-empty-room save to PostgreSQL snapshots
        │
        └── Redis pub/sub (room:<id> channels)
              fans out binary Yjs updates to all WS server instances
        │
  PostgreSQL (users, rooms, snapshots — binary Yjs state)
  Redis      (pub/sub, presence cache)
```

### Key data flows

**Draw → sync:**
User draws → Yjs encodes binary CRDT update → WebSocket sends to server → server applies to room Y.Doc + publishes to Redis → Redis fans out to all WS instances → peers apply update → canvas re-renders via RAF loop

**New user joins:**
Client connects → sends `join_room` → server loads latest Postgres snapshot + in-memory ops → `Y.encodeStateAsUpdate(roomDoc)` → sends full binary state → client applies → canvas fully caught up in one round trip

**Room deleted by owner:**
Owner calls `DELETE /api/rooms/:id` → server broadcasts `room_deleted` WS event to all connected clients → clients show notification banner → redirect to dashboard after 3 s → server deletes room from DB

**Offline:**
WS disconnects → y-indexeddb keeps local state → reconnect → Yjs syncs delta from server → deduplicates already-applied ops automatically

**Why CRDTs not locks:** Yjs uses YATA — operations are commutative and associative. Any two states merged in any order always converge to the same result. No central sequencer needed, no locking, no last-write-wins data loss.

---

## Project Structure

```
collab-canvas/
├── apps/
│   ├── web/                          # Next.js 14 frontend
│   │   └── src/
│   │       ├── app/
│   │       │   ├── page.tsx          # Landing (guest) / Dashboard (authed)
│   │       │   ├── login/
│   │       │   ├── register/
│   │       │   └── room/[id]/        # Canvas room page
│   │       ├── components/
│   │       │   ├── Canvas.tsx        # Canvas element, TextEditor overlay, delete + export
│   │       │   └── Toolbar.tsx       # Tool picker, colors, stroke width, undo/redo
│   │       ├── hooks/
│   │       │   ├── useCollaboration.ts  # WS + Yjs sync + presence + room_deleted handling
│   │       │   └── useCanvas.ts         # Drawing, pan/zoom, select, resize, RAF loop
│   │       ├── lib/
│   │       │   ├── canvas-renderer.ts   # renderShape, resize handles, bbox, selection ring
│   │       │   ├── hit-test.ts          # Click → shape detection (per-type geometry)
│   │       │   ├── yjs.ts               # Y.Doc factory, UndoManager, y-indexeddb provider
│   │       │   └── op-queue.ts          # Offline op buffer
│   │       └── store/
│   │           └── canvas.store.ts      # Active tool, colors, stroke width, selectedShapeId
│   │
│   └── server/                       # Express + WebSocket backend
│       └── src/
│           ├── routes/               # auth, rooms, users
│           ├── controllers/
│           ├── middleware/           # JWT verify, rate limit, error handler
│           ├── metrics.ts            # prom-client — Prometheus metrics registry
│           ├── websocket/
│           │   ├── ws-server.ts          # Binary/JSON message routing
│           │   ├── room-handler.ts       # Y.Doc per room, snapshot load/save, broadcast
│           │   ├── presence-handler.ts   # Cursor broadcast
│           │   └── redis-pubsub.ts       # Cross-instance binary fan-out
│           ├── services/
│           │   ├── auth.service.ts
│           │   ├── room.service.ts       # createRoom, deleteRoom (owner), leaveRoom (editor)
│           │   └── snapshot.service.ts   # Yjs state ↔ PostgreSQL
│           └── db/
│               ├── prisma.ts
│               └── redis.ts
│
└── packages/
    └── types/                        # Shared TypeScript types
        └── src/
            ├── canvas.types.ts       # Shape, Tool, Point — all shape variants
            ├── room.types.ts
            ├── user.types.ts
            └── ws-events.types.ts    # WS_EVENTS constants, CursorPosition
```

---

## Getting Started (local)

### Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- Docker + Docker Compose

### 1. Clone and install

```bash
git clone https://github.com/debarshimaity2004/collab-canvas.git
cd collab-canvas
pnpm install
```

### 2. Start infrastructure

```bash
docker compose up -d
```

Starts PostgreSQL on `5432` and Redis on `6379`.

### 3. Run database migrations

```bash
pnpm --filter @collab-canvas/server db:migrate
```

### 4. Start development servers

**Terminal 1 — backend:**
```bash
pnpm --filter @collab-canvas/server dev
```

**Terminal 2 — frontend:**
```bash
pnpm --filter @collab-canvas/web dev
```

| Service | URL |
|---|---|
| Web app | http://localhost:3000 |
| API server | http://localhost:4000 |
| WebSocket | ws://localhost:4000 (same port, HTTP upgrade) |
| Health check | http://localhost:4000/health |
| Metrics | http://localhost:4000/metrics |

---

## API Reference

### Auth

| Method | Endpoint | Body | Description |
|---|---|---|---|
| POST | `/api/auth/register` | `{ email, password, name }` | Create account, sets httpOnly refresh cookie |
| POST | `/api/auth/login` | `{ email, password }` | Login, sets httpOnly refresh cookie |
| POST | `/api/auth/refresh` | — (uses cookie) | Rotate tokens silently |
| POST | `/api/auth/logout` | — | Clears refresh cookie |

### Rooms

All room endpoints require `Authorization: Bearer <accessToken>`.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/rooms` | List rooms you belong to (includes your `role`) |
| POST | `/api/rooms` | Create a room (`{ name }`) |
| GET | `/api/rooms/:id` | Get room details + members |
| DELETE | `/api/rooms/:id` | Delete room permanently (owner only) — broadcasts `room_deleted` to active clients |
| POST | `/api/rooms/:id/leave` | Leave room — removes you from members (editor only) |
| POST | `/api/rooms/:id/members` | Invite member by email (`{ email }`) |

### Observability

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Readiness probe — returns `{ status: "ok" }` |
| GET | `/metrics` | Prometheus scrape endpoint |

---

## WebSocket Protocol

Connect: `ws://localhost:4000?token=<accessToken>`

**Client → Server**

```json
{ "event": "join_room",   "payload": { "roomId": "uuid" } }
{ "event": "leave_room",  "payload": {} }
{ "event": "cursor_move", "payload": { "x": 120, "y": 340, "color": "#6366f1" } }
```

Canvas updates are sent as **raw binary** (Yjs `Uint8Array`) — not JSON.

**Server → Client**

```json
{ "event": "room_state",      "payload": { "roomId": "...", "members": [...] } }
{ "event": "user_joined",     "payload": { "userId": "...", "name": "..." } }
{ "event": "user_left",       "payload": { "userId": "..." } }
{ "event": "presence_update", "payload": { "userId": "...", "x": 120, "y": 340, "color": "..." } }
{ "event": "room_deleted",    "payload": { "roomId": "..." } }
```

Canvas updates from peers are forwarded as **raw binary** Yjs updates.

---

## Database Schema

```prisma
User        id, email, password (bcrypt), name, createdAt
Room        id, name, createdAt
RoomMember  userId, roomId, role ('owner' | 'editor')
Snapshot    id, roomId, data (Bytes — binary Yjs state), version, createdAt
```

---

## Roadmap

### Phase 1 — Foundation ✅
- [x] Monorepo scaffold (pnpm workspaces, shared types package)
- [x] Docker compose: PostgreSQL + Redis
- [x] Prisma schema + migrations
- [x] JWT auth: register, login, refresh, logout (httpOnly cookie)
- [x] Room CRUD REST API + member invite

### Phase 2 — Real-time Core ✅
- [x] Canvas renderer: Canvas API + requestAnimationFrame loop
- [x] Drawing tools: rect, ellipse, freehand pen
- [x] Yjs Y.Doc + Y.Map CRDT integration + UndoManager
- [x] Binary WebSocket protocol for Yjs updates
- [x] Server-side Y.Doc per room (new joiner state recovery)
- [x] Live cursor positions with name labels

### Phase 3 — Scale + Polish ✅
- [x] Redis pub/sub for binary canvas fan-out (horizontal scaling)
- [x] Snapshot service: Yjs state saved to PostgreSQL (survives server restart)
- [x] y-indexeddb local persistence (instant reload)
- [x] Pan + zoom: hand tool, Space+drag, middle mouse, scroll wheel
- [x] Arrow tool with filled arrowhead
- [x] Text tool with auto-grow, drag-to-scale font
- [x] Select + drag to move shapes
- [x] Resize handles for all shape types (8 handles; 2 for arrows)
- [x] Delete: floating button + Delete/Backspace keyboard shortcut
- [x] Access token auto-refresh on 401 (transparent to user)
- [x] Role-aware delete/leave on dashboard (owner deletes room, editor leaves room)

### Phase 4 — Production ✅
- [x] Deploy to Render (live public URL)
- [x] HTTP + WebSocket on single port (Render compatible)
- [x] Prometheus metrics endpoint (`/metrics`)
- [x] Export canvas as PNG
- [x] Password visibility toggle on auth forms
- [x] Room deletion broadcasts `room_deleted` WS event — collaborators notified and redirected

---

## Key Engineering Decisions

**CRDTs over Operational Transform** — OT requires a central server to serialize all operations and cannot scale horizontally. Yjs uses YATA, where any two states can be merged in any order and always converge. No coordinator needed, no data loss under concurrent edits.

**Binary WebSocket protocol** — Yjs natively encodes updates as compact binary. Sending raw `Uint8Array` over WebSocket avoids JSON serialization overhead and base64 bloat. The server uses the `isBinary` flag to route canvas updates vs. JSON control messages.

**Server-side Y.Doc + PostgreSQL snapshots** — The server maintains one Yjs document per active room in memory. Every 50 ops (and when the last user leaves) the doc is compressed to a binary snapshot and saved to Postgres. On join, the server merges the latest snapshot with any in-memory ops before sending state to the new client — fast joins, durable state.

**Redis pub/sub for horizontal scaling** — Each WS server instance subscribes to a Redis channel per room (`room:<id>`). A canvas update arriving on instance-1 is published to Redis and forwarded to all subscribers — no direct instance-to-instance coupling needed. Adding more WS instances is a config change, not an architecture change.

**Raw Canvas API** — No Konva, Fabric.js, or other canvas library. The renderer is a pure function over shape state, driven by a `requestAnimationFrame` loop with a single `ctx.setTransform` call for pan/zoom. Full control, no abstraction tax, demonstrates rendering fundamentals.

**Viewport-invariant resize handles** — Handle size is computed as `8 / ctx.getTransform().a` so handles stay exactly 8 px on screen regardless of zoom level.

**Room deletion broadcast** — The server sends `room_deleted` over WebSocket before deleting from the database, giving active clients time to receive the event and navigate away gracefully rather than hitting dangling requests.

---

## License

MIT
