import type { Shape, RectShape, EllipseShape, PenShape } from '@collab-canvas/types'

export function renderShape(ctx: CanvasRenderingContext2D, shape: Shape) {
  ctx.save()
  ctx.strokeStyle = shape.strokeColor
  ctx.fillStyle = shape.fillColor === 'transparent' ? 'rgba(0,0,0,0)' : shape.fillColor
  ctx.lineWidth = shape.strokeWidth

  switch (shape.type) {
    case 'rect':
      renderRect(ctx, shape)
      break
    case 'ellipse':
      renderEllipse(ctx, shape)
      break
    case 'pen':
      renderPen(ctx, shape)
      break
  }

  ctx.restore()
}

function renderRect(ctx: CanvasRenderingContext2D, s: RectShape) {
  ctx.beginPath()
  ctx.rect(s.x, s.y, s.width, s.height)
  ctx.fill()
  ctx.stroke()
}

function renderEllipse(ctx: CanvasRenderingContext2D, s: EllipseShape) {
  ctx.beginPath()
  ctx.ellipse(
    s.x + s.width / 2,
    s.y + s.height / 2,
    Math.abs(s.width / 2),
    Math.abs(s.height / 2),
    0,
    0,
    Math.PI * 2
  )
  ctx.fill()
  ctx.stroke()
}

function renderPen(ctx: CanvasRenderingContext2D, s: PenShape) {
  if (s.points.length < 2) return
  ctx.beginPath()
  ctx.moveTo(s.points[0].x, s.points[0].y)
  for (let i = 1; i < s.points.length; i++) {
    ctx.lineTo(s.points[i].x, s.points[i].y)
  }
  ctx.stroke()
}

export function clearCanvas(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.clearRect(0, 0, width, height)
}
