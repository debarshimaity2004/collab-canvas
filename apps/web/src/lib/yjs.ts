import * as Y from 'yjs'
import type { Shape } from '@collab-canvas/types'

export function createYDoc() {
  const doc = new Y.Doc()
  const shapes = doc.getMap<Shape>('shapes')
  const undoManager = new Y.UndoManager(shapes)
  return { doc, shapes, undoManager }
}
