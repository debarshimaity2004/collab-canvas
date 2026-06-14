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
    default:
      return false
  }
}
