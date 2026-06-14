import { WebSocketServer } from 'ws'
import { AuthenticatedSocket } from './ws-server.js'
import { WS_EVENTS } from '@collab-canvas/types'
import { subscribeToRoom, unsubscribeFromRoom } from './redis-pubsub.js'

// roomId → Set of connected socket userId
const rooms = new Map<string, Set<string>>()

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
}

export function handleRoomLeave(socket: AuthenticatedSocket, wss: WebSocketServer) {
  if (!socket.roomId) return

  const roomId = socket.roomId
  rooms.get(roomId)?.delete(socket.userId)
  if (rooms.get(roomId)?.size === 0) {
    rooms.delete(roomId)
    unsubscribeFromRoom(roomId)
  }

  broadcastToRoom(wss, roomId, {
    event: WS_EVENTS.USER_LEFT,
    payload: { userId: socket.userId },
  })

  socket.roomId = undefined
}
