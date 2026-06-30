import { WebSocketServer } from 'ws'
import * as Y from 'yjs'
import { AuthenticatedSocket } from './ws-server.js'
import { WS_EVENTS } from '@collab-canvas/types'
import { subscribeToRoom, unsubscribeFromRoom, publishCanvasUpdate } from './redis-pubsub.js'
import { saveSnapshot, loadSnapshot } from '../services/snapshot.service.js'

const rooms = new Map<string, Set<string>>()

// roomId → live Y.Doc (in-memory, authoritative while users are connected)
const roomDocs = new Map<string, Y.Doc>()

// roomId → single init promise — prevents duplicate snapshot loads on concurrent joins
const roomDocInit = new Map<string, Promise<Y.Doc>>()

// Save to Postgres every N updates to guard against mid-session crashes
const updateCounts = new Map<string, number>()
const SNAPSHOT_INTERVAL = 50

async function getOrInitRoomDoc(roomId: string): Promise<Y.Doc> {
  if (roomDocs.has(roomId)) return roomDocs.get(roomId)!

  if (!roomDocInit.has(roomId)) {
    roomDocInit.set(
      roomId,
      (async () => {
        const loaded = await loadSnapshot(roomId)
        const doc = loaded ?? new Y.Doc()
        roomDocs.set(roomId, doc)
        return doc
      })(),
    )
  }

  return roomDocInit.get(roomId)!
}

export function getRoomSockets(wss: WebSocketServer, roomId: string): AuthenticatedSocket[] {
  return [...wss.clients].filter(
    (c) => (c as AuthenticatedSocket).roomId === roomId,
  ) as AuthenticatedSocket[]
}

export function broadcastToRoom(
  wss: WebSocketServer,
  roomId: string,
  data: unknown,
  excludeId?: string,
) {
  const msg = JSON.stringify(data)
  getRoomSockets(wss, roomId).forEach((client) => {
    if (client.userId !== excludeId && client.readyState === client.OPEN) {
      client.send(msg)
    }
  })
}

export function handleCanvasUpdate(
  socket: AuthenticatedSocket,
  update: Buffer,
  _wss: WebSocketServer,
) {
  const roomId = socket.roomId!
  const doc = roomDocs.get(roomId)
  if (!doc) return

  Y.applyUpdate(doc, update)
  publishCanvasUpdate(roomId, update, socket.userId)

  // Periodic snapshot — fire-and-forget, errors don't block the draw path
  const count = (updateCounts.get(roomId) ?? 0) + 1
  updateCounts.set(roomId, count)
  if (count % SNAPSHOT_INTERVAL === 0) {
    saveSnapshot(roomId, doc).catch((err) =>
      console.error(`Periodic snapshot failed for room ${roomId}:`, err),
    )
  }
}

export async function handleRoomJoin(
  socket: AuthenticatedSocket,
  roomId: string,
  wss: WebSocketServer,
) {
  socket.roomId = roomId

  if (!rooms.has(roomId)) rooms.set(roomId, new Set())
  rooms.get(roomId)!.add(socket.userId)

  subscribeToRoom(roomId)

  broadcastToRoom(
    wss,
    roomId,
    { event: WS_EVENTS.USER_JOINED, payload: { userId: socket.userId, name: socket.userName } },
    socket.userId,
  )

  socket.send(
    JSON.stringify({
      event: WS_EVENTS.ROOM_STATE,
      payload: { roomId, members: [...rooms.get(roomId)!] },
    }),
  )

  // Load from snapshot if this is the first join after a server restart
  const doc = await getOrInitRoomDoc(roomId)
  const state = Y.encodeStateAsUpdate(doc)
  // Yjs empty state is 2 bytes — only send if there's actual content
  if (state.byteLength > 2) {
    socket.send(Buffer.from(state))
  }
}

export async function handleRoomLeave(socket: AuthenticatedSocket, wss: WebSocketServer) {
  if (!socket.roomId) return

  const roomId = socket.roomId
  rooms.get(roomId)?.delete(socket.userId)

  broadcastToRoom(wss, roomId, {
    event: WS_EVENTS.USER_LEFT,
    payload: { userId: socket.userId },
  })

  socket.roomId = undefined

  if (rooms.get(roomId)?.size === 0) {
    rooms.delete(roomId)
    unsubscribeFromRoom(roomId)
    updateCounts.delete(roomId)

    // Persist final state before evicting from memory
    const doc = roomDocs.get(roomId)
    if (doc) {
      roomDocs.delete(roomId)
      roomDocInit.delete(roomId)
      await saveSnapshot(roomId, doc).catch((err) =>
        console.error(`Final snapshot failed for room ${roomId}:`, err),
      )
    }
  }
}
