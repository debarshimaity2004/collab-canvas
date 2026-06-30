import type { Shape, Point } from '@collab-canvas/types'

export function hitTest(shapes: Shape[], point: Point): Shape | null {
  // Iterate in reverse so topmost shape wins
  for (let i = shapes.length - 1; i >= 0; i--) {
    if (isPointInShape(point, shapes[i])) return shapes[i]
  }
  return null
}

function isPointInShape(point: Point, shape: Shape): boolean {
  switch (shape.type) {
    case 'rect':
      return (
        point.x >= shape.x &&
        point.x <= shape.x + shape.width &&
        point.y >= shape.y &&
        point.y <= shape.y + shape.height
      )
    case 'ellipse': {
      const cx = shape.x + shape.width / 2
      const cy = shape.y + shape.height / 2
      const rx = Math.abs(shape.width / 2)
      const ry = Math.abs(shape.height / 2)
      return ((point.x - cx) / rx) ** 2 + ((point.y - cy) / ry) ** 2 <= 1
    }
    case 'pen': {
      if (!shape.points.length) return false
      const xs = shape.points.map((p) => p.x)
      const ys = shape.points.map((p) => p.y)
      const pad = Math.max(shape.strokeWidth * 2, 8)
      return (
        point.x >= Math.min(...xs) - pad &&
        point.x <= Math.max(...xs) + pad &&
        point.y >= Math.min(...ys) - pad &&
        point.y <= Math.max(...ys) + pad
      )
    }
    case 'arrow': {
      const dx = shape.endX - shape.x
      const dy = shape.endY - shape.y
      const len2 = dx * dx + dy * dy
      if (len2 === 0) return false
      const t = Math.max(0, Math.min(1, ((point.x - shape.x) * dx + (point.y - shape.y) * dy) / len2))
      const distSq = (point.x - (shape.x + t * dx)) ** 2 + (point.y - (shape.y + t * dy)) ** 2
      return distSq <= Math.max(shape.strokeWidth * 2, 8) ** 2
    }
    case 'text': {
      const w = shape.width > 0 ? shape.width
        : Math.max(...shape.text.split('\n').map((l) => l.length)) * shape.fontSize * 0.6
      const h = shape.height > 0 ? shape.height
        : shape.text.split('\n').length * shape.fontSize * 1.2
      return (
        point.x >= shape.x &&
        point.x <= shape.x + w &&
        point.y >= shape.y &&
        point.y <= shape.y + h
      )
    }
    default:
      return false
  }
}
