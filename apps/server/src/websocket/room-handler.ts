import { WebSocketServer } from 'ws'
import * as Y from 'yjs'
import { AuthenticatedSocket } from './ws-server.js'
import { WS_EVENTS } from '@collab-canvas/types'
import { subscribeToRoom, unsubscribeFromRoom } from './redis-pubsub.js'

// roomId → Set of connected socket userId
const rooms = new Map<string, Set<string>>()

// roomId → server-side Y.Doc (accumulates all updates for state recovery on join)
const roomDocs = new Map<string, Y.Doc>()

function getRoomDoc(roomId: string): Y.Doc {
  if (!roomDocs.has(roomId)) {
    roomDocs.set(roomId, new Y.Doc())
  }
  return roomDocs.get(roomId)!
}

export function getRoomSockets(wss: WebSocketServer, roomId: string): AuthenticatedSocket[] {
  return [...wss.clients].filter(
    (c) => (c as AuthenticatedSocket).roomId === roomId
  ) as AuthenticatedSocket[]
}

export function broadcastToRoom(wss: WebSocketServer, roomId: string, data: unknown, excludeId?: string) {
  const msg = JSON.stringify(data)
  getRoomSockets(wss, roomId).forEach((client) => {
    if (client.userId !== excludeId && client.readyState === client.OPEN) {
      client.send(msg)
    }
  })
}

export function handleCanvasUpdate(socket: AuthenticatedSocket, update: Buffer, wss: WebSocketServer) {
  const roomId = socket.roomId!
  const doc = getRoomDoc(roomId)

  // Merge update into server-side doc so new joiners get full state
  Y.applyUpdate(doc, update)

  // Broadcast binary update directly to all other peers in the room
  getRoomSockets(wss, roomId).forEach((client) => {
    if (client.userId !== socket.userId && client.readyState === client.OPEN) {
      client.send(update)
    }
  })
}

export function handleRoomJoin(socket: AuthenticatedSocket, roomId: string, wss: WebSocketServer) {
  socket.roomId = roomId

  if (!rooms.has(roomId)) rooms.set(roomId, new Set())
  rooms.get(roomId)!.add(socket.userId)

  subscribeToRoom(roomId, wss)

  broadcastToRoom(wss, roomId, {
    event: WS_EVENTS.USER_JOINED,
    payload: { userId: socket.userId, name: socket.userName },
  }, socket.userId)

  socket.send(JSON.stringify({
    event: WS_EVENTS.ROOM_STATE,
    payload: { roomId, members: [...rooms.get(roomId)!] },
  }))

  // Send accumulated Yjs state so new joiner catches up instantly
  const doc = getRoomDoc(roomId)
  const state = Y.encodeStateAsUpdate(doc)
  // Yjs empty state is 2 bytes — only send if there's actual content
  if (state.byteLength > 2) {
    socket.send(Buffer.from(state))
  }
}

export function handleRoomLeave(socket: AuthenticatedSocket, wss: WebSocketServer) {
  if (!socket.roomId) return

  const roomId = socket.roomId
  rooms.get(roomId)?.delete(socket.userId)
  if (rooms.get(roomId)?.size === 0) {
    rooms.delete(roomId)
    unsubscribeFromRoom(roomId)
    // Keep the Y.Doc alive for a bit in case users rejoin — GC handled by Node process
  }

  broadcastToRoom(wss, roomId, {
    event: WS_EVENTS.USER_LEFT,
    payload: { userId: socket.userId },
  })

  socket.roomId = undefined
}
