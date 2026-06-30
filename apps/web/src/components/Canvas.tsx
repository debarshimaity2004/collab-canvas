'use client'

import { useRef, useEffect, useState } from 'react'
import { useCanvas } from '../hooks/useCanvas'
import { getShapeBBox } from '../lib/canvas-renderer'
import { useCanvasStore } from '../store/canvas.store'
import type * as Y from 'yjs'
import type { Shape, CursorPosition, TextShape } from '@collab-canvas/types'
import type { Viewport } from '../hooks/useCanvas'

interface CanvasProps {
  shapes: Y.Map<Shape> | null
  userId: string
  cursors: Map<string, CursorPosition>
  sendCursor: (x: number, y: number) => void
}

interface TextEditorProps {
  shape: TextShape
  viewport: Viewport
  shapes: Y.Map<Shape>
  onFinish: () => void
}

function TextEditor({ shape, viewport, shapes, onFinish }: TextEditorProps) {
  const [value, setValue] = useState(shape.text)
  // Local font size so dragging the resize grip updates the textarea immediately
  const [fontSize, setFontSize] = useState(shape.fontSize)
  const ref = useRef<HTMLTextAreaElement>(null)
  const isAutoResizing = useRef(false)
  const hasManualResized = useRef(shape.width > 0 || shape.height > 0)
  // Baseline values captured at mount — used to compute the scale ratio on drag
  const originalFontSize = useRef(shape.fontSize)
  const originalHeightPx = useRef(0)

  // Set initial size on mount
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (shape.width > 0) {
      el.style.width = `${shape.width * viewport.scale}px`
    } else {
      // Default width for a new text box
      el.style.width = `${Math.max(180, shape.fontSize * viewport.scale * 8)}px`
    }
    if (shape.height > 0) {
      el.style.height = `${shape.height * viewport.scale}px`
      originalHeightPx.current = shape.height * viewport.scale
    } else {
      // Default height: ~2 lines for a new text box
      const defaultH = shape.fontSize * viewport.scale * 2.8
      el.style.height = `${defaultH}px`
      originalHeightPx.current = defaultH
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-grow height as user types — disabled only after a manual resize
  useEffect(() => {
    const el = ref.current
    if (!el || hasManualResized.current) return
    isAutoResizing.current = true
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
    originalHeightPx.current = el.scrollHeight
    setTimeout(() => { isAutoResizing.current = false }, 0)
  }, [value])

  // Sync manual drag-resize to Yjs and scale font size proportionally
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      if (isAutoResizing.current) return
      hasManualResized.current = true
      const current = shapes.get(shape.id)
      if (!current || current.type !== 'text') return
      const ratio = originalHeightPx.current > 0 ? el.offsetHeight / originalHeightPx.current : 1
      const newFontSize = Math.max(6, Math.round(originalFontSize.current * ratio))
      setFontSize(newFontSize)
      shapes.set(shape.id, {
        ...current,
        width: el.offsetWidth / viewport.scale,
        height: el.offsetHeight / viewport.scale,
        fontSize: newFontSize,
      })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [shapes, shape.id, viewport.scale])

  // Close when clicking outside (capture phase — fires before canvas mousedown)
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onFinish()
      }
    }
    document.addEventListener('mousedown', handleOutside, true)
    return () => document.removeEventListener('mousedown', handleOutside, true)
  }, [onFinish])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setValue(text)
    const current = shapes.get(shape.id)
    if (current) shapes.set(shape.id, { ...current, text })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); onFinish() }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onFinish() }
  }

  const screenX = shape.x * viewport.scale + viewport.x
  const screenY = shape.y * viewport.scale + viewport.y
  const scaledFontSize = shape.fontSize * viewport.scale

  return (
    <textarea
      ref={ref}
      autoFocus
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      rows={1}
      aria-label="Text input"
      title="Type text. Enter to confirm, Escape to cancel, Shift+Enter for newline."
      className="absolute p-0 m-0 bg-transparent outline-none"
      style={{
        left: screenX,
        top: screenY,
        fontSize: `${scaledFontSize}px`,
        fontFamily: 'sans-serif',
        color: shape.strokeColor,
        lineHeight: 1.2,
        minWidth: 120,
        minHeight: `${scaledFontSize * 1.4}px`,
        resize: 'both',
        overflow: 'auto',
        border: '1.5px dashed #4f46e5',
        caretColor: shape.strokeColor,
      }}
    />
  )
}

export function Canvas({ shapes, userId, cursors, sendCursor }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { selectedShapeId, setSelectedShapeId } = useCanvasStore()

  const { viewport, editingShapeId, finishEditing } = useCanvas(canvasRef, {
    shapes,
    userId,
    onCursorMove: sendCursor,
  })

  const editingShape =
    editingShapeId && shapes ? (shapes.get(editingShapeId) as TextShape | undefined) : undefined

  // Compute floating delete button position above the selected shape's bbox
  const deleteBtn = (() => {
    if (!selectedShapeId || !shapes || editingShapeId) return null
    const shape = shapes.get(selectedShapeId)
    if (!shape) return null
    const bbox = getShapeBBox(shape)
    const cx = bbox.x * viewport.scale + viewport.x + (bbox.width * viewport.scale) / 2
    const top = bbox.y * viewport.scale + viewport.y
    // Place above the shape; if too close to the top edge, place below instead
    const y = top > 48 ? top - 40 : top + bbox.height * viewport.scale + 8
    return { x: cx, y }
  })()

  function handleDelete() {
    if (!selectedShapeId || !shapes) return
    shapes.delete(selectedShapeId)
    setSelectedShapeId(null)
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full bg-white cursor-crosshair"
      />

      {/* Floating delete button for the selected shape */}
      {deleteBtn && (
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleDelete}
          className="absolute flex items-center gap-1.5 px-2.5 py-1.5 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white text-xs font-medium rounded-lg shadow-lg transition-colors z-20"
          style={{ left: deleteBtn.x, top: deleteBtn.y, transform: 'translateX(-50%)' }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1.5 3h9M4.5 3V1.5h3V3M3 3l.75 7.5h4.5L9 3H3z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Delete
        </button>
      )}

      {/* Text editor overlay — shown while a text shape is being edited */}
      {editingShape && shapes && (
        <TextEditor
          shape={editingShape}
          viewport={viewport}
          shapes={shapes}
          onFinish={finishEditing}
        />
      )}

      {/* Remote cursors: positions are in world space, convert to screen */}
      {[...cursors.values()].map((cursor) => (
        <div
          key={cursor.userId}
          className="absolute pointer-events-none"
          style={{
            left: cursor.x * viewport.scale + viewport.x,
            top: cursor.y * viewport.scale + viewport.y,
            transform: 'translate(-2px, -2px)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M0 0 L0 12 L3.5 8.5 L6 13 L8 12 L5.5 7.5 L10 7.5 Z"
              fill={cursor.color}
              stroke="white"
              strokeWidth="1"
            />
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
