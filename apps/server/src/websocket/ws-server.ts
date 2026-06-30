import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage, Server } from 'http'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import type { Session } from '@collab-canvas/types'
import { handleRoomJoin, handleRoomLeave, handleCanvasUpdate } from './room-handler.js'
import { handlePresence } from './presence-handler.js'
import { initRedisPubSub } from './redis-pubsub.js'
import { WS_EVENTS } from '@collab-canvas/types'
import { wsConnectionsActive, wsConnectionsTotal } from '../metrics.js'

export interface AuthenticatedSocket extends WebSocket {
  userId: string
  userName: string
  roomId?: string
}

export function createWsServer(server: Server) {
  const wss = new WebSocketServer({ server })

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    wsConnectionsActive.inc()
    wsConnectionsTotal.inc()
    const url = new URL(req.url ?? '/', `ws://localhost`)
    const token = url.searchParams.get('token')

    if (!token) {
      ws.close(1008, 'Token required')
      return
    }

    let session: Session
    try {
      session = jwt.verify(token, env.JWT_ACCESS_SECRET) as Session
    } catch {
      ws.close(1008, 'Invalid token')
      return
    }

    const socket = ws as AuthenticatedSocket
    socket.userId = session.userId
    socket.userName = session.name

    socket.on('message', (data, isBinary) => {
      if (isBinary) {
        // Binary Yjs canvas update — apply to room doc and broadcast to peers
        if (socket.roomId) handleCanvasUpdate(socket, data as Buffer, wss)
        return
      }
      try {
        const msg = JSON.parse((data as Buffer).toString())
        switch (msg.event) {
          case WS_EVENTS.JOIN_ROOM:
            handleRoomJoin(socket, msg.payload.roomId, wss).catch((err) =>
              console.error('handleRoomJoin error:', err),
            )
            break
          case WS_EVENTS.LEAVE_ROOM:
            handleRoomLeave(socket, wss).catch((err) =>
              console.error('handleRoomLeave error:', err),
            )
            break
          case WS_EVENTS.CURSOR_MOVE:
            handlePresence(socket, msg.payload, wss)
            break
        }
      } catch (err) {
        console.error('WS message error:', err)
      }
    })

    socket.on('close', () => {
      wsConnectionsActive.dec()
      handleRoomLeave(socket, wss).catch((err) => console.error('handleRoomLeave on close:', err))
    })
  })

  initRedisPubSub(wss)
  console.log('WebSocket server attached to HTTP server')
  return wss
}
