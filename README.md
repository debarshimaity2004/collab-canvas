# CollabCanvas

A production-grade real-time collaborative whiteboard. Multiple users can draw on a shared canvas simultaneously — changes sync instantly across all connected clients with zero conflicts, powered by CRDTs (Yjs).

Think lightweight Figma, built from scratch.

---

## What's working right now

- **Register / login** with JWT auth (httpOnly cookie for refresh token)
- **Dashboard** — create rooms, see all your rooms as cards with previews
- **Real-time canvas** — draw rectangles, ellipses, and freehand pen strokes; changes appear on all connected tabs instantly
- **CRDT sync** — binary Yjs updates over WebSocket; no conflicts, ever
- **Undo / redo** — backed by Yjs UndoManager
- **Live cursors** — see teammates' cursor positions with name labels in real time
- **Invite to room** — share link or invite by email; new joiner catches up instantly via full Y.Doc state transfer
- **Offline buffering** — ops queue in memory while disconnected, flush on reconnect

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 + TypeScript |
| Canvas | Canvas API (raw, no library) |
| CRDT | Yjs (Y.Doc, Y.Map, UndoManager) |
| State | Zustand |
| Forms | React Hook Form + Zod |
| Backend | Node.js + Express + TypeScript |
| WebSocket | ws library (binary Yjs protocol) |
| Pub/Sub | Redis (ioredis) |
| Database | PostgreSQL + Prisma ORM |
| Styling | TailwindCSS |
| Infra | Docker + docker-compose |
| Monorepo | pnpm workspaces |

---

## Architecture

```
Browser
  ├── Canvas API + RAF render loop
  ├── Yjs Y.Doc  (Y.Map<Shape> — CRDT state)
  ├── UndoManager
  └── WebSocket client
        │  binary Yjs updates (draw ops)
        │  JSON control messages (join/leave/cursor)
        ▼
  Express API  (JWT auth, rate limiting, room CRUD)
  WebSocket Server  (port 4001)
        │
        ├── server-side Y.Doc per room
        │     accumulates updates → sent to new joiners on join
        │
        └── Redis pub/sub (room:<id> channels)
              fans out to all WS server instances
        │
  PostgreSQL (users, rooms, snapshots)
  Redis      (pub/sub, presence cache)
```

### Key data flows

**Draw → sync:**
User draws → Yjs encodes binary CRDT update → WebSocket sends to server → server applies to room Y.Doc + broadcasts binary to all peers → peers apply update → canvas re-renders via RAF loop

**New user joins:**
Client connects → sends `join_room` → server calls `Y.encodeStateAsUpdate(roomDoc)` → sends full binary state → client applies → canvas fully caught up in one round trip

**Offline:**
WS disconnects → ops queue in memory → reconnect → queue flushes in order → Yjs deduplicates already-applied ops

**Why CRDTs not locks:** Yjs YATA operations are commutative and associative — any two states merged in any order always converge to the same result. No central sequencer needed.

---

## Project Structure

```
collab-canvas/
├── apps/
│   ├── web/                        # Next.js 14 frontend
│   │   └── src/
│   │       ├── app/
│   │       │   ├── page.tsx        # Landing page (guest) / Dashboard (authed)
│   │       │   ├── login/
│   │       │   ├── register/
│   │       │   └── room/[id]/      # Canvas room
│   │       ├── components/
│   │       │   ├── Canvas.tsx      # Canvas element + remote cursor overlay
│   │       │   └── Toolbar.tsx     # Tool picker, colors, undo/redo
│   │       ├── hooks/
│   │       │   ├── useCollaboration.ts  # WS + Yjs sync + presence
│   │       │   └── useCanvas.ts         # Drawing logic + RAF loop
│   │       ├── lib/
│   │       │   ├── canvas-renderer.ts
│   │       │   ├── yjs.ts               # Y.Doc factory + UndoManager
│   │       │   └── op-queue.ts          # Offline op buffer
│   │       └── store/
│   │           └── canvas.store.ts      # Active tool, colors, stroke width
│   │
│   └── server/                     # Express + WebSocket backend
│       └── src/
│           ├── routes/             # auth, rooms, users
│           ├── controllers/
│           ├── middleware/         # JWT verify, rate limit, error handler
│           ├── websocket/
│           │   ├── ws-server.ts        # Binary/JSON message routing
│           │   ├── room-handler.ts     # Y.Doc per room, canvas update broadcast
│           │   ├── presence-handler.ts # Cursor broadcast
│           │   └── redis-pubsub.ts     # Cross-instance fan-out
│           ├── services/
│           │   ├── auth.service.ts
│           │   ├── room.service.ts
│           │   └── snapshot.service.ts # Yjs state ↔ PostgreSQL
│           └── db/
│               ├── prisma.ts
│               └── redis.ts
│
└── packages/
    └── types/                      # Shared TypeScript types
        └── src/
            ├── canvas.types.ts     # Shape, Tool, Point, DrawOp
            ├── room.types.ts
            ├── user.types.ts       # Session, AuthTokens
            └── ws-events.types.ts  # WS_EVENTS constants, CursorPosition
```

---

## Getting Started

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

Enter `init` when prompted for a migration name.

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
| WebSocket | ws://localhost:4001 |
| Health check | http://localhost:4000/health |

---

## API Reference

### Auth

| Method | Endpoint | Body | Description |
|---|---|---|---|
| POST | `/api/auth/register` | `{ email, password, name }` | Create account, sets httpOnly refresh cookie |
| POST | `/api/auth/login` | `{ email, password }` | Login, sets httpOnly refresh cookie |
| POST | `/api/auth/refresh` | cookie or `{ refreshToken }` | Rotate tokens |
| POST | `/api/auth/logout` | — | Clears refresh cookie |

Login and register return `{ accessToken, userId, name }`. The refresh token is set as an httpOnly cookie automatically.

### Rooms

All room endpoints require `Authorization: Bearer <accessToken>`.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/rooms` | List rooms you belong to |
| POST | `/api/rooms` | Create a room (`{ name }`) |
| GET | `/api/rooms/:id` | Get room details + members |
| DELETE | `/api/rooms/:id` | Delete room (owner only) |
| POST | `/api/rooms/:id/members` | Invite member by email (`{ email }`) |

### Users

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/users/me` | Get current user profile |

---

## WebSocket Protocol

Connect: `ws://localhost:4001?token=<accessToken>`

**Client → Server**

JSON control messages:
```json
{ "event": "join_room",   "payload": { "roomId": "uuid" } }
{ "event": "leave_room",  "payload": {} }
{ "event": "cursor_move", "payload": { "x": 120, "y": 340, "color": "#6366f1" } }
```

Canvas updates are sent as **raw binary** (Yjs encoded `Uint8Array`) — not JSON.

**Server → Client**

JSON events:
```json
{ "event": "room_state",      "payload": { "roomId": "...", "members": [...] } }
{ "event": "user_joined",     "payload": { "userId": "...", "name": "..." } }
{ "event": "user_left",       "payload": { "userId": "..." } }
{ "event": "presence_update", "payload": { "userId": "...", "name": "...", "x": 120, "y": 340, "color": "..." } }
```

Canvas updates from peers are forwarded as **raw binary** Yjs updates. On room join, the server also sends a binary `Y.encodeStateAsUpdate(doc)` so the new client catches up to the full canvas state.

---

## Database Schema

```prisma
User        id, email, password (bcrypt), name, createdAt
Room        id, name, createdAt
RoomMember  userId, roomId, role (editor)
Snapshot    id, roomId, data (Bytes — binary Yjs state), version, createdAt
```

---

## Roadmap

### Phase 1 — Foundation ✅
- [x] Monorepo scaffold (pnpm workspaces, shared types package)
- [x] Docker compose: PostgreSQL + Redis
- [x] Prisma schema + migrations
- [x] JWT auth: register, login, refresh, logout
- [x] httpOnly cookie for refresh token
- [x] Room CRUD REST API + member invite

### Phase 2 — Real-time Core ✅
- [x] Canvas renderer: Canvas API + requestAnimationFrame loop
- [x] Drawing tools: rect, ellipse, freehand pen
- [x] Yjs Y.Doc + Y.Map CRDT integration
- [x] UndoManager (undo/redo)
- [x] Binary WebSocket protocol for Yjs updates
- [x] Server-side Y.Doc per room (new joiner state recovery)
- [x] Live cursor positions with name labels
- [x] Offline op queue with reconnect flush

### Phase 3 — Scale + Polish (next)
- [ ] Redis pub/sub for binary canvas fan-out (multi-instance)
- [ ] y-indexeddb local persistence (instant reload)
- [ ] Snapshot service: periodic Yjs state save to PostgreSQL
- [ ] Pan + zoom via matrix transform
- [ ] Additional tools: text, arrow, select + resize
- [ ] Room name shown on canvas page

### Phase 4 — Production
- [ ] Prometheus metrics: connected users, op latency, room count
- [ ] Nginx reverse proxy
- [ ] Docker production build
- [ ] Deploy to VPS / Railway

---

## Key Engineering Decisions

**CRDTs over Operational Transform** — OT requires a central server to serialize all operations and cannot scale horizontally. Yjs uses YATA, where any two states can be merged in any order and always converge. No coordinator needed.

**Binary WebSocket protocol** — Yjs natively encodes updates as compact binary. Sending raw `Uint8Array` over WebSocket avoids JSON serialization overhead and base64 bloat. The server uses the `isBinary` flag to route canvas updates vs. JSON control messages.

**Server-side Y.Doc per room** — The server maintains one Yjs document per active room in memory, applying every incoming update. When a new user joins, `Y.encodeStateAsUpdate(doc)` gives them the full canvas state in a single binary message — no need for a snapshot read on every join.

**Raw Canvas API** — No Konva, Fabric.js, or other canvas library. The renderer is a pure function over shape state, driven by a `requestAnimationFrame` loop. This demonstrates CS fundamentals and gives full control over rendering performance.

---

## License

MIT
