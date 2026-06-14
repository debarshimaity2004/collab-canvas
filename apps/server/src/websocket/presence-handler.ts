import { WebSocketServer } from 'ws'
import { AuthenticatedSocket } from './ws-server.js'
import { WS_EVENTS } from '@collab-canvas/types'
import { broadcastToRoom } from './room-handler.js'

export function handlePresence(
  socket: AuthenticatedSocket,
  payload: { x: number; y: number; color: string },
  wss: WebSocketServer
) {
  if (!socket.roomId) return

  broadcastToRoom(wss, socket.roomId, {
    event: WS_EVENTS.PRESENCE_UPDATE,
    payload: {
      userId: socket.userId,
      name: socket.userName,
      x: payload.x,
      y: payload.y,
      color: payload.color,
    },
  }, socket.userId)
}
