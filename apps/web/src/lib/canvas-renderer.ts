import type { Shape, RectShape, EllipseShape, PenShape, TextShape, ArrowShape, Point } from '@collab-canvas/types'

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
    case 'text':
      renderText(ctx, shape)
      break
    case 'arrow':
      renderArrow(ctx, shape)
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
    Math.PI * 2,
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

function renderArrow(ctx: CanvasRenderingContext2D, s: ArrowShape) {
  const dx = s.endX - s.x
  const dy = s.endY - s.y
  if (Math.sqrt(dx * dx + dy * dy) < 1) return

  ctx.beginPath()
  ctx.moveTo(s.x, s.y)
  ctx.lineTo(s.endX, s.endY)
  ctx.stroke()

  const angle = Math.atan2(dy, dx)
  const headLen = Math.max(18, s.strokeWidth * 7)
  ctx.beginPath()
  ctx.moveTo(s.endX, s.endY)
  ctx.lineTo(s.endX - headLen * Math.cos(angle - Math.PI / 5), s.endY - headLen * Math.sin(angle - Math.PI / 5))
  ctx.lineTo(s.endX - headLen * Math.cos(angle + Math.PI / 5), s.endY - headLen * Math.sin(angle + Math.PI / 5))
  ctx.closePath()
  ctx.fillStyle = s.strokeColor
  ctx.fill()
}

function renderText(ctx: CanvasRenderingContext2D, s: TextShape) {
  if (!s.text) return
  ctx.fillStyle = s.strokeColor
  ctx.font = `${s.fontSize}px sans-serif`
  ctx.textBaseline = 'top'
  const lineHeight = s.fontSize * 1.2
  s.text.split('\n').forEach((line, i) => {
    ctx.fillText(line, s.x, s.y + i * lineHeight)
  })
}

// Returns the axis-aligned bounding box for any shape type
export function getShapeBBox(shape: Shape): { x: number; y: number; width: number; height: number } {
  if (shape.type === 'arrow') {
    const minX = Math.min(shape.x, shape.endX)
    const minY = Math.min(shape.y, shape.endY)
    return { x: minX, y: minY, width: Math.abs(shape.endX - shape.x), height: Math.abs(shape.endY - shape.y) }
  }
  if (shape.type === 'pen' && shape.points.length > 0) {
    const xs = shape.points.map((p: Point) => p.x)
    const ys = shape.points.map((p: Point) => p.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY }
  }
  if (shape.type === 'text') {
    if (shape.width > 0 && shape.height > 0) {
      return { x: shape.x, y: shape.y, width: shape.width, height: shape.height }
    }
    const lines = shape.text.split('\n')
    const w = Math.max(...lines.map((l) => l.length)) * shape.fontSize * 0.6
    const h = lines.length * shape.fontSize * 1.2
    return { x: shape.x, y: shape.y, width: w, height: h }
  }
  return { x: shape.x, y: shape.y, width: shape.width, height: shape.height }
}

export function renderSelectionHighlight(ctx: CanvasRenderingContext2D, shape: Shape) {
  const { x, y, width, height } = getShapeBBox(shape)
  const scale = ctx.getTransform().a
  const pad = 4 / scale
  ctx.save()
  ctx.strokeStyle = '#4f46e5'
  ctx.lineWidth = 1.5 / scale
  ctx.setLineDash([4 / scale, 3 / scale])
  ctx.strokeRect(x - pad, y - pad, width + pad * 2, height + pad * 2)
  ctx.setLineDash([])
  ctx.restore()
}

export function clearCanvas(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.clearRect(0, 0, width, height)
}

// ── Resize handles ────────────────────────────────────────────────────────────
export type ResizeHandle = 'tl' | 'tc' | 'tr' | 'lc' | 'rc' | 'bl' | 'bc' | 'br' | 'start' | 'end'

export function getResizeHandlePositions(
  shape: Shape,
): Array<{ handle: ResizeHandle; x: number; y: number }> {
  if (shape.type === 'arrow') {
    return [
      { handle: 'start', x: shape.x, y: shape.y },
      { handle: 'end', x: shape.endX, y: shape.endY },
    ]
  }
  const { x, y, width, height } = getShapeBBox(shape)
  const mx = x + width / 2
  const my = y + height / 2
  return [
    { handle: 'tl', x, y },
    { handle: 'tc', x: mx, y },
    { handle: 'tr', x: x + width, y },
    { handle: 'lc', x, y: my },
    { handle: 'rc', x: x + width, y: my },
    { handle: 'bl', x, y: y + height },
    { handle: 'bc', x: mx, y: y + height },
    { handle: 'br', x: x + width, y: y + height },
  ]
}

export function renderResizeHandles(ctx: CanvasRenderingContext2D, shape: Shape) {
  const scale = ctx.getTransform().a
  const hs = 8 / scale

  ctx.save()
  ctx.setLineDash([])
  ctx.fillStyle = 'white'
  ctx.strokeStyle = '#4f46e5'
  ctx.lineWidth = 1.5 / scale

  for (const { x, y } of getResizeHandlePositions(shape)) {
    ctx.fillRect(x - hs / 2, y - hs / 2, hs, hs)
    ctx.strokeRect(x - hs / 2, y - hs / 2, hs, hs)
  }
  ctx.restore()
}
