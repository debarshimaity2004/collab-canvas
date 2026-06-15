import { WebSocketServer } from 'ws'
import { redis, redisSub } from '../db/redis.js'
import { WS_EVENTS } from '@collab-canvas/types'
import { getRoomSockets } from './room-handler.js'

const subscribedRooms = new Set<string>()

function channelForRoom(roomId: string) {
  return `room:${roomId}`
}

export function publishToRoom(roomId: string, data: unknown) {
  redis.publish(channelForRoom(roomId), JSON.stringify(data))
}

export function subscribeToRoom(roomId: string, wss: WebSocketServer) {
  if (subscribedRooms.has(roomId)) return
  subscribedRooms.add(roomId)

  redisSub.subscribe(channelForRoom(roomId))

  redisSub.on('message', (channel: string, message: string) => {
    const rid = channel.replace('room:', '')
    const sockets = getRoomSockets(wss, rid)
    sockets.forEach((s) => {
      if (s.readyState === s.OPEN) s.send(message)
    })
  })
}

export function unsubscribeFromRoom(roomId: string) {
  subscribedRooms.delete(roomId)
  redisSub.unsubscribe(channelForRoom(roomId))
}

// Publish binary Yjs update to all room peers via Redis
export function publishCanvasUpdate(roomId: string, update: Buffer, senderUserId: string) {
  const payload = JSON.stringify({
    event: WS_EVENTS.CANVAS_UPDATE,
    payload: { update: update.toString('base64'), senderUserId },
  })
  redis.publish(channelForRoom(roomId), payload)
}
