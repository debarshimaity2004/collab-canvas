'use client'

import { useRef } from 'react'
import { useCanvas } from '../hooks/useCanvas'
import type * as Y from 'yjs'
import type { Shape, CursorPosition } from '@collab-canvas/types'

interface CanvasProps {
  shapes: Y.Map<Shape> | null
  userId: string
  cursors: Map<string, CursorPosition>
  sendCursor: (x: number, y: number) => void
}

export function Canvas({ shapes, userId, cursors, sendCursor }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useCanvas(canvasRef, { shapes, userId, onCursorMove: sendCursor })

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-crosshair bg-white"
      />
      {/* Remote cursors */}
      {[...cursors.values()].map((cursor) => (
        <div
          key={cursor.userId}
          className="absolute pointer-events-none"
          style={{ left: cursor.x, top: cursor.y, transform: 'translate(-2px, -2px)' }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M0 0 L0 12 L3.5 8.5 L6 13 L8 12 L5.5 7.5 L10 7.5 Z" fill={cursor.color} stroke="white" strokeWidth="1" />
          </svg>
          <span
            className="absolute left-4 top-0 px-1.5 py-0.5 rounded text-xs text-white whitespace-nowrap"
            style={{ backgroundColor: cursor.color }}
          >
            {cursor.name}
          </span>
        </div>
      ))}
    </div>
  )
}
