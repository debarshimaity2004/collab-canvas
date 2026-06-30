'use client'

import type { Tool } from '@collab-canvas/types'
import { useCanvasStore } from '../store/canvas.store'

const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: 'select', label: 'Select', icon: '↖' },
  { id: 'hand', label: 'Pan (drag canvas)', icon: '✋' },
  { id: 'rect', label: 'Rectangle', icon: '▭' },
  { id: 'ellipse', label: 'Ellipse', icon: '◯' },
  { id: 'arrow', label: 'Arrow', icon: '→' },
  { id: 'pen', label: 'Pen', icon: '✏' },
  { id: 'text', label: 'Text', icon: 'T' },
]

interface ToolbarProps {
  undoManager: import('yjs').UndoManager | null
}

export function Toolbar({ undoManager }: ToolbarProps) {
  const { tool, strokeColor, fillColor, strokeWidth, setTool, setStrokeColor, setFillColor, setStrokeWidth } =
    useCanvasStore()

  return (
    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col gap-1 bg-gray-800 border border-gray-700 rounded-xl p-2 shadow-lg z-10">
      {TOOLS.map((t) => (
        <button
          type="button"
          key={t.id}
          title={t.label}
          onClick={() => setTool(t.id)}
          className={`w-9 h-9 flex items-center justify-center rounded-lg text-lg transition-colors ${
            tool === t.id
              ? 'bg-indigo-600 text-white'
              : 'text-gray-300 hover:bg-gray-700'
          }`}
        >
          {t.icon}
        </button>
      ))}

      <div className="border-t border-gray-700 mt-1 pt-2 flex flex-col gap-2">
        <label className="flex flex-col items-center gap-0.5">
          <span className="text-gray-500 text-[9px] uppercase tracking-wide">Stroke</span>
          <input
            type="color"
            value={strokeColor}
            onChange={(e) => setStrokeColor(e.target.value)}
            className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent"
          />
        </label>

        <label className="flex flex-col items-center gap-0.5">
          <span className="text-gray-500 text-[9px] uppercase tracking-wide">Fill</span>
          <input
            type="color"
            value={fillColor === 'transparent' ? '#ffffff' : fillColor}
            onChange={(e) => setFillColor(e.target.value)}
            className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent"
          />
        </label>

        <label className="flex flex-col items-center gap-0.5">
          <span className="text-gray-500 text-[9px] uppercase tracking-wide">Width</span>
          <input
            type="range"
            min={1}
            max={16}
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            className="toolbar-stroke-width-slider w-7 accent-indigo-500"
          />
        </label>
      </div>

      {undoManager && (
        <div className="border-t border-gray-700 mt-1 pt-2 flex flex-col gap-1">
          <button
            type="button"
            title="Undo (Ctrl+Z)"
            onClick={() => undoManager.undo()}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-300 hover:bg-gray-700 text-sm"
          >
            ↩
          </button>
          <button
            type="button"
            title="Redo (Ctrl+Y)"
            onClick={() => undoManager.redo()}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-300 hover:bg-gray-700 text-sm"
          >
            ↪
          </button>
        </div>
      )}
    </div>
  )
}
