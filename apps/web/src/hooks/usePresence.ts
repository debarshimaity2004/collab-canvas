'use client'

import { useEffect, useState, useRef } from 'react'
import type { CursorPosition } from '@collab-canvas/types'
import { WS_EVENTS } from '@collab-canvas/types'

// Tracks remote cursors received via PRESENCE_UPDATE messages from the server.
// Local cursor is broadcast via sendCursor from useCollaboration.
export function usePresence(ws: WebSocket | null) {
  const [cursors, setCursors] = useState<Map<string, CursorPosition>>(new Map())

  useEffect(() => {
    if (!ws) return

    const onMessage = (event: MessageEvent) => {
      if (typeof event.data !== 'string') return
      try {
        const msg = JSON.parse(event.data)
        if (msg.event === WS_EVENTS.PRESENCE_UPDATE) {
          const cursor = msg.payload as CursorPosition
          setCursors((prev) => new Map(prev).set(cursor.userId, cursor))
        }
        if (msg.event === WS_EVENTS.USER_LEFT) {
          setCursors((prev) => {
            const next = new Map(prev)
            next.delete(msg.payload.userId)
            return next
          })
        }
      } catch {}
    }

    ws.addEventListener('message', onMessage)
    return () => ws.removeEventListener('message', onMessage)
  }, [ws])

  return cursors
}
