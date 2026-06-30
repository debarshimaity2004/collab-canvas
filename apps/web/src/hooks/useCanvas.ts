'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import * as Y from 'yjs'
import type { Shape, Tool, Point } from '@collab-canvas/types'
import {
  renderShape,
  renderSelectionHighlight,
  renderResizeHandles,
  getResizeHandlePositions,
  getShapeBBox,
} from '../lib/canvas-renderer'
import type { ResizeHandle } from '../lib/canvas-renderer'
import { hitTest } from '../lib/hit-test'
import { useCanvasStore } from '../store/canvas.store'

export interface Viewport {
  x: number
  y: number
  scale: number
}

const MIN_SCALE = 0.05
const MAX_SCALE = 20
const DEFAULT_FONT_SIZE = 20

interface UseCanvasOptions {
  shapes: Y.Map<Shape> | null
  userId: string
  onCursorMove?: (x: number, y: number) => void
}

// ── Resize helpers (pure, no hook state) ─────────────────────────────────────

function hitTestResizeHandle(shape: Shape, point: Point, scale: number): ResizeHandle | null {
  const threshold = 8 / scale
  for (const { handle, x, y } of getResizeHandlePositions(shape)) {
    if (Math.abs(point.x - x) <= threshold && Math.abs(point.y - y) <= threshold) return handle
  }
  return null
}

function getCursorForHandle(handle: ResizeHandle): string {
  if (handle === 'tl' || handle === 'br') return 'nwse-resize'
  if (handle === 'tr' || handle === 'bl') return 'nesw-resize'
  if (handle === 'tc' || handle === 'bc') return 'ns-resize'
  return 'ew-resize'
}

function applyResize(shape: Shape, handle: ResizeHandle, dx: number, dy: number): Shape {
  if (shape.type === 'arrow') {
    if (handle === 'start') return { ...shape, x: shape.x + dx, y: shape.y + dy }
    if (handle === 'end') return { ...shape, endX: shape.endX + dx, endY: shape.endY + dy }
    return shape
  }

  const bbox = getShapeBBox(shape)
  const { x: bx, y: by, width: bw, height: bh } = bbox
  let x = bx, y = by, width = bw, height = bh

  switch (handle) {
    case 'tl': x += dx; y += dy; width -= dx; height -= dy; break
    case 'tc':           y += dy;              height -= dy; break
    case 'tr':           y += dy; width += dx; height -= dy; break
    case 'lc': x += dx;           width -= dx;               break
    case 'rc':                     width += dx;               break
    case 'bl': x += dx;           width -= dx; height += dy; break
    case 'bc':                                  height += dy; break
    case 'br':                     width += dx; height += dy; break
  }

  const MIN = 10
  if (width < MIN) {
    width = MIN
    if (handle === 'tl' || handle === 'lc' || handle === 'bl') x = bx + bw - MIN
  }
  if (height < MIN) {
    height = MIN
    if (handle === 'tl' || handle === 'tc' || handle === 'tr') y = by + bh - MIN
  }

  if (shape.type === 'pen' && shape.points.length > 0) {
    const sx = bw > 0 ? width / bw : 1
    const sy = bh > 0 ? height / bh : 1
    return {
      ...shape,
      points: shape.points.map((p) => ({ x: x + (p.x - bx) * sx, y: y + (p.y - by) * sy })),
    }
  }

  if (shape.type === 'text') {
    const newFontSize = Math.max(6, Math.round(shape.fontSize * (height / (bh || height))))
    return { ...shape, x, y, width, height, fontSize: newFontSize }
  }

  return { ...shape, x, y, width, height }
}

// ─────────────────────────────────────────────────────────────────────────────

export function useCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  { shapes, userId, onCursorMove }: UseCanvasOptions,
) {
  const { tool, strokeColor, fillColor, strokeWidth, selectedShapeId, setSelectedShapeId } =
    useCanvasStore()

  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 })
  const viewportRef = useRef<Viewport>({ x: 0, y: 0, scale: 1 })

  const [editingShapeId, setEditingShapeId] = useState<string | null>(null)
  const editingShapeIdRef = useRef<string | null>(null)

  const syncViewport = useCallback((vp: Viewport) => {
    viewportRef.current = vp
    setViewport(vp)
  }, [])

  const syncEditingId = useCallback((id: string | null) => {
    editingShapeIdRef.current = id
    setEditingShapeId(id)
  }, [])

  // Drawing / pan / select / drag state — all in refs to avoid stale closures
  const isDrawing = useRef(false)
  const isPanning = useRef(false)
  const isDraggingShape = useRef(false)
  const currentShapeId = useRef<string | null>(null)
  const startPoint = useRef<Point>({ x: 0, y: 0 })
  const panStart = useRef({ mouseX: 0, mouseY: 0, vpX: 0, vpY: 0 })
  const dragStartWorld = useRef<Point>({ x: 0, y: 0 })
  const dragShape = useRef<Shape | null>(null)
  const penPoints = useRef<Point[]>([])
  const spaceHeld = useRef(false)

  // Resize state
  const isResizing = useRef(false)
  const resizeHandle = useRef<ResizeHandle | null>(null)
  const resizeShapeSnapshot = useRef<Shape | null>(null)
  const resizeStartPoint = useRef<Point>({ x: 0, y: 0 })

  const selectedShapeIdRef = useRef<string | null>(selectedShapeId)
  const shapesRef = useRef<Y.Map<Shape> | null>(shapes)
  useEffect(() => { selectedShapeIdRef.current = selectedShapeId }, [selectedShapeId])
  useEffect(() => { shapesRef.current = shapes }, [shapes])

  // Finish editing: remove shape if empty, clear editing state
  const finishEditing = useCallback(() => {
    const id = editingShapeIdRef.current
    if (id) {
      const shape = shapesRef.current?.get(id)
      if (shape?.type === 'text' && !shape.text.trim()) {
        shapesRef.current?.delete(id)
      }
    }
    syncEditingId(null)
  }, [syncEditingId])

  // Switching away from the text tool finishes any in-progress edit
  useEffect(() => {
    if (tool !== 'text') finishEditing()
  }, [tool, finishEditing])

  // Update canvas cursor when the active tool changes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || spaceHeld.current) return
    if (tool === 'select') canvas.style.cursor = 'default'
    else if (tool === 'text') canvas.style.cursor = 'text'
    else if (tool === 'hand') canvas.style.cursor = 'grab'
    else canvas.style.cursor = 'crosshair'
  }, [tool, canvasRef])

  // RAF render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !shapes) return

    const ctx = canvas.getContext('2d')!
    let rafId: number

    const render = () => {
      const { x, y, scale } = viewportRef.current
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.setTransform(scale, 0, 0, scale, x, y)
      shapes.forEach((shape) => {
        // Hide the text shape while it's being edited — the textarea shows it instead
        if (shape.id === editingShapeIdRef.current) return
        renderShape(ctx, shape)
      })
      const selId = selectedShapeIdRef.current
      if (selId && selId !== editingShapeIdRef.current) {
        const sel = shapes.get(selId)
        if (sel) {
          renderSelectionHighlight(ctx, sel)
          renderResizeHandles(ctx, sel)
        }
      }
      rafId = requestAnimationFrame(render)
    }

    rafId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(rafId)
  }, [canvasRef, shapes])

  // Keep canvas pixel dimensions in sync with its CSS size
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    })
    observer.observe(canvas)
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
    return () => observer.disconnect()
  }, [canvasRef])

  const getCanvasPoint = useCallback(
    (e: MouseEvent): Point => {
      const rect = canvasRef.current!.getBoundingClientRect()
      const { x, y, scale } = viewportRef.current
      return {
        x: (e.clientX - rect.left - x) / scale,
        y: (e.clientY - rect.top - y) / scale,
      }
    },
    [canvasRef],
  )

  const makeBaseShape = useCallback(
    (id: string, t: Tool, start: Point): Shape => {
      const base = {
        id,
        type: t,
        x: start.x,
        y: start.y,
        width: 0,
        height: 0,
        strokeColor,
        fillColor,
        strokeWidth,
        createdBy: userId,
        createdAt: Date.now(),
      }
      if (t === 'pen') return { ...base, type: 'pen', points: [start] }
      if (t === 'rect') return { ...base, type: 'rect' }
      if (t === 'ellipse') return { ...base, type: 'ellipse' }
      if (t === 'text') return { ...base, type: 'text', text: '', fontSize: DEFAULT_FONT_SIZE }
      if (t === 'arrow') return { ...base, type: 'arrow', endX: start.x, endY: start.y }
      return { ...base, type: 'rect' }
    },
    [strokeColor, fillColor, strokeWidth, userId],
  )

  const onWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault()
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      const { x, y, scale } = viewportRef.current
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor))
      const worldX = (mouseX - x) / scale
      const worldY = (mouseY - y) / scale
      syncViewport({ scale: newScale, x: mouseX - worldX * newScale, y: mouseY - worldY * newScale })
    },
    [canvasRef, syncViewport],
  )

  const onMouseDown = useCallback(
    (e: MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && spaceHeld.current) || (e.button === 0 && tool === 'hand')) {
        e.preventDefault()
        isPanning.current = true
        const { x, y } = viewportRef.current
        panStart.current = { mouseX: e.clientX, mouseY: e.clientY, vpX: x, vpY: y }
        if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
        return
      }

      if (e.button !== 0 || !shapes) return

      // Note: if a TextEditor is open, its capture-phase document mousedown listener
      // already called finishEditing() before this handler runs — editingShapeIdRef
      // is already null here, so the same click can immediately start a new text shape.

      const point = getCanvasPoint(e)

      if (tool === 'select') {
        // Resize handle check before drag — handles sit on top of the shape
        const selId = selectedShapeIdRef.current
        if (selId) {
          const sel = shapes.get(selId)
          if (sel) {
            const handle = hitTestResizeHandle(sel, point, viewportRef.current.scale)
            if (handle) {
              isResizing.current = true
              resizeHandle.current = handle
              resizeShapeSnapshot.current = sel
              resizeStartPoint.current = point
              return
            }
          }
        }
        const hit = hitTest([...shapes.values()], point)
        if (hit) {
          setSelectedShapeId(hit.id)
          isDraggingShape.current = true
          dragStartWorld.current = point
          dragShape.current = hit
        } else {
          setSelectedShapeId(null)
        }
        return
      }

      if (tool === 'text') {
        // Click on existing text → re-open it for editing
        const hit = hitTest([...shapes.values()].filter((s) => s.type === 'text'), point)
        if (hit) {
          syncEditingId(hit.id)
          setSelectedShapeId(hit.id)
        } else {
          // Place a new text shape and immediately open editor
          const id = crypto.randomUUID()
          const shape = makeBaseShape(id, 'text', point)
          shapes.set(id, shape)
          syncEditingId(id)
          setSelectedShapeId(id)
        }
        return
      }

      const id = crypto.randomUUID()
      isDrawing.current = true
      currentShapeId.current = id
      startPoint.current = point
      penPoints.current = [point]
      shapes.set(id, makeBaseShape(id, tool, point))
    },
    [shapes, tool, getCanvasPoint, makeBaseShape, setSelectedShapeId, syncEditingId, finishEditing, canvasRef],
  )

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isPanning.current) {
        const { mouseX, mouseY, vpX, vpY } = panStart.current
        syncViewport({ ...viewportRef.current, x: vpX + (e.clientX - mouseX), y: vpY + (e.clientY - mouseY) })
        return
      }

      const point = getCanvasPoint(e)

      if (isDraggingShape.current && dragShape.current && shapes) {
        const dx = point.x - dragStartWorld.current.x
        const dy = point.y - dragStartWorld.current.y
        const orig = dragShape.current
        const updated: Shape =
          orig.type === 'pen'
            ? { ...orig, points: orig.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
            : orig.type === 'arrow'
            ? { ...orig, x: orig.x + dx, y: orig.y + dy, endX: orig.endX + dx, endY: orig.endY + dy }
            : { ...orig, x: orig.x + dx, y: orig.y + dy }
        shapes.set(orig.id, updated)
        return
      }

      if (isResizing.current && resizeHandle.current && resizeShapeSnapshot.current && shapes) {
        const dx = point.x - resizeStartPoint.current.x
        const dy = point.y - resizeStartPoint.current.y
        const updated = applyResize(resizeShapeSnapshot.current, resizeHandle.current, dx, dy)
        shapes.set(resizeShapeSnapshot.current.id, updated)
        return
      }

      onCursorMove?.(point.x, point.y)

      // Update cursor when hovering over resize handles (idle select mode)
      if (tool === 'select' && canvasRef.current && !spaceHeld.current) {
        const selId = selectedShapeIdRef.current
        const sel = selId && shapesRef.current ? shapesRef.current.get(selId) : null
        if (sel) {
          const handle = hitTestResizeHandle(sel, point, viewportRef.current.scale)
          canvasRef.current.style.cursor = handle ? getCursorForHandle(handle) : 'default'
        }
      }

      if (!isDrawing.current || !shapes || !currentShapeId.current) return

      const id = currentShapeId.current
      const start = startPoint.current
      const existing = shapes.get(id)
      if (!existing) return

      if (existing.type === 'pen') {
        penPoints.current.push(point)
        shapes.set(id, { ...existing, points: [...penPoints.current] })
      } else if (existing.type === 'arrow') {
        shapes.set(id, { ...existing, endX: point.x, endY: point.y })
      } else {
        shapes.set(id, {
          ...existing,
          x: Math.min(start.x, point.x),
          y: Math.min(start.y, point.y),
          width: Math.abs(point.x - start.x),
          height: Math.abs(point.y - start.y),
        })
      }
    },
    [shapes, tool, canvasRef, getCanvasPoint, onCursorMove, syncViewport],
  )

  const toolRef = useRef(tool)
  useEffect(() => { toolRef.current = tool }, [tool])

  const onMouseUp = useCallback(() => {
    if (isPanning.current) {
      isPanning.current = false
      if (canvasRef.current) {
        const t = toolRef.current
        const base = t === 'select' ? 'default' : t === 'text' ? 'text' : t === 'hand' ? 'grab' : 'crosshair'
        canvasRef.current.style.cursor = spaceHeld.current ? 'grab' : base
      }
      return
    }
    if (isResizing.current) {
      isResizing.current = false
      resizeHandle.current = null
      resizeShapeSnapshot.current = null
      return
    }
    if (isDraggingShape.current) {
      isDraggingShape.current = false
      dragShape.current = null
      return
    }
    isDrawing.current = false
    currentShapeId.current = null
    penPoints.current = []
  }, [canvasRef])

  // Keyboard: Space (pan mode), Delete/Backspace (delete shape)
  // Guard against firing when a textarea/input is focused
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isTyping = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT'

      if (e.code === 'Space' && !e.repeat && !isTyping) {
        e.preventDefault()
        spaceHeld.current = true
        if (canvasRef.current) canvasRef.current.style.cursor = 'grab'
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isTyping) {
        const selId = selectedShapeIdRef.current
        if (selId) {
          shapesRef.current?.delete(selId)
          setSelectedShapeId(null)
        }
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeld.current = false
        if (canvasRef.current) {
          const t = toolRef.current
          canvasRef.current.style.cursor = t === 'select' ? 'default' : t === 'text' ? 'text' : t === 'hand' ? 'grab' : 'crosshair'
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [canvasRef, setSelectedShapeId])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('mouseleave', onMouseUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('mouseleave', onMouseUp)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [canvasRef, onMouseDown, onMouseMove, onMouseUp, onWheel])

  return { viewport, editingShapeId, finishEditing }
}
