'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { createYDoc } from '../lib/yjs'
import { OpQueue } from '../lib/op-queue'
import type { Shape, CursorPosition } from '@collab-canvas/types'
import { WS_EVENTS } from '@collab-canvas/types'

// Derive WebSocket URL from the API URL: https:// → wss://, http:// → ws://
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
const WS_URL = API_URL.replace(/^https/, 'wss').replace(/^http/, 'ws')

export interface CollaborationState {
  doc: Y.Doc | null
  shapes: Y.Map<Shape> | null
  undoManager: Y.UndoManager | null
  connected: boolean
  roomDeleted: boolean
  cursors: Map<string, CursorPosition>
  sendCursor: (x: number, y: number) => void
}

const CURSOR_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#6366f1', '#a855f7', '#ec4899',
]

function pickCursorColor(): string {
  return CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)]
}

export function useCollaboration(
  roomId: string,
  token: string | null,
  userId: string,
  userName: string
): CollaborationState {
  const [connected, setConnected] = useState(false)
  const [roomDeleted, setRoomDeleted] = useState(false)
  const [cursors, setCursors] = useState<Map<string, CursorPosition>>(new Map())
  const docRef = useRef<Y.Doc | null>(null)
  const shapesRef = useRef<Y.Map<Shape> | null>(null)
  const undoManagerRef = useRef<Y.UndoManager | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const opQueue = useRef(new OpQueue())
  const cursorColor = useRef(pickCursorColor())

  useEffect(() => {
    if (!token || !roomId) return

    const { doc, shapes, undoManager } = createYDoc()
    docRef.current = doc
    shapesRef.current = shapes
    undoManagerRef.current = undoManager

    // Persist every Yjs update to IndexedDB — loads cached state immediately on next open
    const persistence = new IndexeddbPersistence(`collabcanvas-${roomId}`, doc)

    const ws = new WebSocket(`${WS_URL}?token=${token}`)
    ws.binaryType = 'arraybuffer'
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      ws.send(JSON.stringify({ event: WS_EVENTS.JOIN_ROOM, payload: { roomId } }))
      opQueue.current.flush().forEach((update) => ws.send(update))
    }

    ws.onclose = () => {
      setConnected(false)
      wsRef.current = null
    }

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        // Binary Yjs update from a peer — apply with 'remote' origin to suppress echo
        Y.applyUpdate(doc, new Uint8Array(event.data), 'remote')
        return
      }
      try {
        const msg = JSON.parse(event.data as string)
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
        if (msg.event === WS_EVENTS.ROOM_DELETED) {
          setRoomDeleted(true)
          ws.close()
        }
      } catch {}
    }

    // Send local Yjs updates to the server as binary
    const onUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === 'remote') return
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(update)
      } else {
        opQueue.current.enqueue(update)
      }
    }
    doc.on('update', onUpdate)

    return () => {
      persistence.destroy()
      doc.off('update', onUpdate)
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event: WS_EVENTS.LEAVE_ROOM, payload: {} }))
      }
      ws.close()
      doc.destroy()
      docRef.current = null
      shapesRef.current = null
      undoManagerRef.current = null
    }
  }, [roomId, token])

  const sendCursor = useCallback((x: number, y: number) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        event: WS_EVENTS.CURSOR_MOVE,
        payload: { x, y, color: cursorColor.current },
      }))
    }
  }, [])

  return {
    doc: docRef.current,
    shapes: shapesRef.current,
    undoManager: undoManagerRef.current,
    connected,
    roomDeleted,
    cursors,
    sendCursor,
  }
}
