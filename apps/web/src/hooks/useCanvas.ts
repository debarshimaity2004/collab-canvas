'use client'

import { useEffect, useRef, useCallback } from 'react'
import * as Y from 'yjs'
import type { Shape, Tool, Point } from '@collab-canvas/types'
import { renderShape, clearCanvas } from '../lib/canvas-renderer'
import { useCanvasStore } from '../store/canvas.store'

interface UseCanvasOptions {
  shapes: Y.Map<Shape> | null
  userId: string
  onCursorMove?: (x: number, y: number) => void
}

export function useCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  { shapes, userId, onCursorMove }: UseCanvasOptions
) {
  const { tool, strokeColor, fillColor, strokeWidth } = useCanvasStore()

  // Drawing state held in refs to avoid stale closures inside event listeners
  const isDrawing = useRef(false)
  const currentShapeId = useRef<string | null>(null)
  const startPoint = useRef<Point>({ x: 0, y: 0 })
  const penPoints = useRef<Point[]>([])

  // RAF render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !shapes) return

    const ctx = canvas.getContext('2d')!
    let rafId: number

    const render = () => {
      clearCanvas(ctx, canvas.width, canvas.height)
      shapes.forEach((shape) => renderShape(ctx, shape))
      rafId = requestAnimationFrame(render)
    }

    rafId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(rafId)
  }, [canvasRef, shapes])

  // Resize observer so canvas pixel size matches its CSS size
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

  const getCanvasPoint = useCallback((e: MouseEvent): Point => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [canvasRef])

  const makeBaseShape = useCallback((id: string, tool: Tool, start: Point): Shape => {
    const base = {
      id,
      type: tool,
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
    if (tool === 'pen') return { ...base, type: 'pen', points: [start] }
    if (tool === 'rect') return { ...base, type: 'rect' }
    if (tool === 'ellipse') return { ...base, type: 'ellipse' }
    // Fallback — shouldn't happen for supported tools
    return { ...base, type: 'rect' }
  }, [strokeColor, fillColor, strokeWidth, userId])

  const onMouseDown = useCallback((e: MouseEvent) => {
    if (!shapes || tool === 'select') return
    const point = getCanvasPoint(e)
    const id = crypto.randomUUID()

    isDrawing.current = true
    currentShapeId.current = id
    startPoint.current = point
    penPoints.current = [point]

    const shape = makeBaseShape(id, tool, point)
    shapes.set(id, shape)
  }, [shapes, tool, getCanvasPoint, makeBaseShape])

  const onMouseMove = useCallback((e: MouseEvent) => {
    const point = getCanvasPoint(e)
    onCursorMove?.(point.x, point.y)

    if (!isDrawing.current || !shapes || !currentShapeId.current) return

    const id = currentShapeId.current
    const start = startPoint.current
    const existing = shapes.get(id)
    if (!existing) return

    if (existing.type === 'pen') {
      penPoints.current.push(point)
      shapes.set(id, { ...existing, points: [...penPoints.current] })
    } else {
      shapes.set(id, {
        ...existing,
        x: Math.min(start.x, point.x),
        y: Math.min(start.y, point.y),
        width: Math.abs(point.x - start.x),
        height: Math.abs(point.y - start.y),
      })
    }
  }, [shapes, getCanvasPoint, onCursorMove])

  const onMouseUp = useCallback(() => {
    isDrawing.current = false
    currentShapeId.current = null
    penPoints.current = []
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('mouseleave', onMouseUp)

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('mouseleave', onMouseUp)
    }
  }, [canvasRef, onMouseDown, onMouseMove, onMouseUp])
}
