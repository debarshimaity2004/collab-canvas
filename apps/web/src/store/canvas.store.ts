import { create } from 'zustand'
import type { Tool, Shape } from '@collab-canvas/types'

interface CanvasState {
  tool: Tool
  strokeColor: string
  fillColor: string
  strokeWidth: number
  selectedShapeId: string | null
  shapes: Map<string, Shape>
  setTool: (tool: Tool) => void
  setStrokeColor: (color: string) => void
  setFillColor: (color: string) => void
  setStrokeWidth: (width: number) => void
  setSelectedShapeId: (id: string | null) => void
  upsertShape: (id: string, shape: Shape) => void
  removeShape: (id: string) => void
}

export const useCanvasStore = create<CanvasState>((set) => ({
  tool: 'rect',
  strokeColor: '#000000',
  fillColor: 'transparent',
  strokeWidth: 2,
  selectedShapeId: null,
  shapes: new Map(),
  setTool: (tool) => set({ tool }),
  setStrokeColor: (strokeColor) => set({ strokeColor }),
  setFillColor: (fillColor) => set({ fillColor }),
  setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
  setSelectedShapeId: (selectedShapeId) => set({ selectedShapeId }),
  upsertShape: (id, shape) =>
    set((state) => ({ shapes: new Map(state.shapes).set(id, shape) })),
  removeShape: (id) =>
    set((state) => {
      const next = new Map(state.shapes)
      next.delete(id)
      return { shapes: next }
    }),
}))
