export type Tool = 'select' | 'rect' | 'ellipse' | 'pen' | 'text' | 'arrow' | 'hand'

export interface Point {
  x: number
  y: number
}

export interface BaseShape {
  id: string
  type: Tool
  x: number
  y: number
  width: number
  height: number
  strokeColor: string
  fillColor: string
  strokeWidth: number
  createdBy: string
  createdAt: number
}

export interface RectShape extends BaseShape {
  type: 'rect'
}

export interface EllipseShape extends BaseShape {
  type: 'ellipse'
}

export interface PenShape extends BaseShape {
  type: 'pen'
  points: Point[]
}

export interface TextShape extends BaseShape {
  type: 'text'
  text: string
  fontSize: number
}

export interface ArrowShape extends BaseShape {
  type: 'arrow'
  endX: number
  endY: number
}

export type Shape = RectShape | EllipseShape | PenShape | TextShape | ArrowShape

export interface DrawOp {
  shapeId: string
  shape: Shape
  timestamp: number
}
