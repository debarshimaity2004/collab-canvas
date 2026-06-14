import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import type { Session } from '@collab-canvas/types'
import { handleRoomJoin, handleRoomLeave } from './room-handler.js'
import { handlePresence } from './presence-handler.js'
import { WS_EVENTS } from '@collab-canvas/types'

export interface AuthenticatedSocket extends WebSocket {
  userId: string
  userName: string
  roomId?: string
}

export function createWsServer(port: number) {
  const wss = new WebSocketServer({ port })

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
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

    socket.on('message', (data) => {
      try {
        // Binary Yjs updates are forwarded as-is; JSON control messages are parsed
        if (typeof data === 'string') {
          const msg = JSON.parse(data)
          switch (msg.event) {
            case WS_EVENTS.JOIN_ROOM:
              handleRoomJoin(socket, msg.payload.roomId, wss)
              break
            case WS_EVENTS.LEAVE_ROOM:
              handleRoomLeave(socket, wss)
              break
            case WS_EVENTS.CURSOR_MOVE:
              handlePresence(socket, msg.payload, wss)
              break
          }
        }
      } catch (err) {
        console.error('WS message error:', err)
      }
    })

    socket.on('close', () => handleRoomLeave(socket, wss))
  })

  console.log(`WebSocket server listening on port ${port}`)
  return wss
}
