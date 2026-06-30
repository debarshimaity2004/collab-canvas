import { WebSocketServer } from 'ws'
import { redis, redisSub } from '../db/redis.js'
import { WS_EVENTS } from '@collab-canvas/types'
import { getRoomSockets } from './room-handler.js'

const subscribedRooms = new Set<string>()
let _wss: WebSocketServer | null = null

// Single listener for all subscribed channels — registered once at init
redisSub.on('message', (channel: string, message: string) => {
  if (!_wss) return
  const roomId = channel.replace('room:', '')

  let parsed: { event: string; payload: { update: string; senderUserId: string } }
  try {
    parsed = JSON.parse(message)
  } catch {
    return
  }

  if (parsed.event !== WS_EVENTS.CANVAS_UPDATE) return

  // Decode base64 back to binary and forward to all local peers except the sender
  const update = Buffer.from(parsed.payload.update, 'base64')
  const { senderUserId } = parsed.payload

  getRoomSockets(_wss, roomId).forEach((s) => {
    if (s.userId !== senderUserId && s.readyState === s.OPEN) {
      s.send(update) // binary — Yjs on the client expects ArrayBuffer
    }
  })
})

function channelForRoom(roomId: string) {
  return `room:${roomId}`
}

// Call once after the WebSocketServer is created
export function initRedisPubSub(wss: WebSocketServer) {
  _wss = wss
}

export function subscribeToRoom(roomId: string) {
  if (subscribedRooms.has(roomId)) return
  subscribedRooms.add(roomId)
  redisSub.subscribe(channelForRoom(roomId))
}

export function unsubscribeFromRoom(roomId: string) {
  subscribedRooms.delete(roomId)
  redisSub.unsubscribe(channelForRoom(roomId))
}

// Publish binary Yjs update through Redis so all WS instances fan it out
export function publishCanvasUpdate(roomId: string, update: Buffer, senderUserId: string) {
  const payload = JSON.stringify({
    event: WS_EVENTS.CANVAS_UPDATE,
    payload: { update: update.toString('base64'), senderUserId },
  })
  redis.publish(channelForRoom(roomId), payload)
}
