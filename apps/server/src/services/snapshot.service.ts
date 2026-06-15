import * as Y from 'yjs'
import { prisma } from '../db/prisma.js'

export async function saveSnapshot(roomId: string, doc: Y.Doc): Promise<void> {
  const data = Buffer.from(Y.encodeStateAsUpdate(doc))

  const latest = await prisma.snapshot.findFirst({
    where: { roomId },
    orderBy: { version: 'desc' },
    select: { version: true },
  })

  await prisma.snapshot.create({
    data: {
      roomId,
      data,
      version: (latest?.version ?? 0) + 1,
    },
  })
}

export async function loadSnapshot(roomId: string): Promise<Y.Doc | null> {
  const snapshot = await prisma.snapshot.findFirst({
    where: { roomId },
    orderBy: { version: 'desc' },
  })

  if (!snapshot) return null

  const doc = new Y.Doc()
  Y.applyUpdate(doc, snapshot.data)
  return doc
}
