# CollabCanvas

A production-grade real-time collaborative whiteboard. Multiple users can draw on a shared canvas simultaneously — changes sync instantly across all connected clients with zero conflicts, powered by CRDTs.

Think lightweight Figma, built from scratch.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 + TypeScript |
| Canvas | Canvas API (raw, no library) |
| CRDT | Yjs + y-websocket + y-indexeddb |
| State | Zustand |
| Backend | Node.js + Express + TypeScript |
| WebSocket | ws + y-websocket server |
| Pub/Sub | Redis (ioredis) |
| Database | PostgreSQL + Prisma ORM |
| Styling | TailwindCSS |
| Infra | Docker + docker-compose |
| Monorepo | pnpm workspaces |

---

## Architecture

```
Browser Client
  └── React UI (toolbar, cursors, avatars)
  └── Canvas Engine (Canvas API, RAF loop, hit testing, pan/zoom)
  └── CRDT Local State (Yjs Y.Doc, Y.Map for shapes, Awareness for cursors)
  └── Sync Layer (WebSocket client, op queue for offline)
  └── IndexedDB (y-indexeddb for local persistence)
        |
        | WebSocket (binary Yjs updates) + REST (auth, room management)
        |
  Express API (JWT auth, rate limiting)
        |
  ┌─────────────────────────────────┐
  │  Auth   Room CRUD   WS Server  │
  │         Redis pub/sub fan-out  │
  └─────────────────────────────────┘
        |
  PostgreSQL (users, rooms, snapshots) + Redis (pub/sub, presence)
```

**How real-time sync works:** When a user draws, Yjs encodes the operation as a binary CRDT update and sends it over WebSocket. The server publishes it to a Redis channel for the room. All other server instances subscribed to that channel forward it to their connected clients, which apply the update and re-render — no conflicts possible due to CRDT math.

**How offline works:** Operations are buffered in an in-memory queue when the WebSocket drops. On reconnect, the queue flushes in order. Yjs deduplicates already-applied ops automatically.

---

## Project Structure

```
collab-canvas/
├── apps/
│   ├── web/          # Next.js 14 frontend
│   └── server/       # Express + WebSocket backend
├── packages/
│   └── types/        # Shared TypeScript types (canvas, room, user, WS events)
└── docker-compose.yml
```

---

## Getting Started

### Prerequisites

- Node.js 18+
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

This starts PostgreSQL on `5432` and Redis on `6379`.

### 3. Configure environment

```bash
cp apps/server/.env.example apps/server/.env
```

Edit `apps/server/.env` and set strong values for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (min 32 chars each).

### 4. Run database migrations

```bash
pnpm --filter @collab-canvas/server exec prisma migrate dev --name init --schema=./prisma/schema.prisma
```

### 5. Start development servers

```bash
pnpm dev
```

| Service | URL |
|---|---|
| Web app | http://localhost:3000 |
| API server | http://localhost:4000 |
| WebSocket | ws://localhost:4001 |

---

## API Reference

### Auth

| Method | Endpoint | Body | Description |
|---|---|---|---|
| POST | `/api/auth/register` | `{ email, password, name }` | Create account |
| POST | `/api/auth/login` | `{ email, password }` | Get access + refresh tokens |
| POST | `/api/auth/refresh` | `{ refreshToken }` | Rotate tokens |

### Rooms

All room endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/rooms` | List rooms you belong to |
| POST | `/api/rooms` | Create a room |
| GET | `/api/rooms/:id` | Get room details + members |
| DELETE | `/api/rooms/:id` | Delete room (owner only) |
| POST | `/api/rooms/:id/members` | Invite member by email |

### Users

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/users/me` | Get current user profile |

---

## WebSocket Protocol

Connect with a valid JWT: `ws://localhost:4001?token=<accessToken>`

**Client → Server (JSON)**

```json
{ "event": "join_room",  "payload": { "roomId": "uuid" } }
{ "event": "leave_room", "payload": {} }
{ "event": "cursor_move","payload": { "x": 120, "y": 340, "color": "#e74c3c" } }
```

Canvas updates are sent as **raw binary** (Yjs encoded), not JSON.

**Server → Client (JSON)**

```json
{ "event": "room_state",     "payload": { "roomId": "...", "members": [...] } }
{ "event": "user_joined",    "payload": { "userId": "...", "name": "..." } }
{ "event": "user_left",      "payload": { "userId": "..." } }
{ "event": "presence_update","payload": { "userId": "...", "x": 120, "y": 340 } }
```

Canvas updates from peers are forwarded as **binary** Yjs updates.

---

## Database Schema

```prisma
User        → id, email, password, name, createdAt
Room        → id, name, createdAt
RoomMember  → userId, roomId, role (owner | editor | viewer)
Snapshot    → id, roomId, data (Bytes — binary Yjs state), version, createdAt
```

---

## Roadmap

- [x] Monorepo scaffold (pnpm workspaces)
- [x] Docker compose: PostgreSQL + Redis
- [x] Prisma schema + client generation
- [x] JWT auth (register, login, refresh)
- [x] Room CRUD REST API
- [x] Shared types package
- [x] WebSocket server skeleton + Redis pub/sub
- [ ] Canvas renderer (Canvas API + RAF loop)
- [ ] Drawing tools: rect, ellipse, freehand pen
- [ ] Pan + zoom via matrix transform
- [ ] Yjs Y.Doc + Y.Map CRDT integration
- [ ] y-websocket provider on frontend
- [ ] Yjs Awareness API for cursor positions
- [ ] y-indexeddb local persistence
- [ ] Snapshot service (periodic Yjs state compression)
- [ ] Prometheus metrics
- [ ] Docker production build + deploy

---

## Key Engineering Decisions

**CRDTs over Operational Transform** — OT requires a central server to serialize all operations and cannot scale horizontally. Yjs uses YATA (Yet Another Transformation Approach), a CRDT where any two states merge in any order and always converge to the same result.

**Redis pub/sub for horizontal scaling** — Each WebSocket server instance subscribes to a Redis channel per room (`room:<id>`). A canvas update from instance-1 is published to Redis and fanned out to all other instances, which forward it to their clients. No direct instance-to-instance coupling.

**Raw Canvas API** — No Konva, Fabric, or other canvas library. The renderer is a pure function over shape state, using `requestAnimationFrame` for the render loop and manual hit-testing for selection.

---

## License

MIT
