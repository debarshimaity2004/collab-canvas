import { Response } from 'express'
import { z } from 'zod'
import { AuthRequest } from '../middleware/auth.middleware.js'
import { createRoom, getRoomsForUser, getRoomById, deleteRoom, addMemberToRoom } from '../services/room.service.js'

const createRoomSchema = z.object({ name: z.string().min(1).max(100) })
const inviteSchema = z.object({ email: z.string().email() })

export async function listRooms(req: AuthRequest, res: Response): Promise<void> {
  const rooms = await getRoomsForUser(req.user!.userId)
  res.json({ rooms })
}

export async function getRoom(req: AuthRequest, res: Response): Promise<void> {
  const room = await getRoomById(req.params.id, req.user!.userId)
  if (!room) { res.status(404).json({ error: 'Room not found' }); return }
  res.json({ room })
}

export async function createRoomHandler(req: AuthRequest, res: Response): Promise<void> {
  const result = createRoomSchema.safeParse(req.body)
  if (!result.success) { res.status(400).json({ error: result.error.flatten().fieldErrors }); return }

  try {
    const room = await createRoom(result.data.name, req.user!.userId)
    res.status(201).json({ room })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
}

export async function deleteRoomHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    await deleteRoom(req.params.id, req.user!.userId)
    res.status(204).send()
  } catch (err) {
    res.status(403).json({ error: (err as Error).message })
  }
}

export async function inviteMember(req: AuthRequest, res: Response): Promise<void> {
  const result = inviteSchema.safeParse(req.body)
  if (!result.success) { res.status(400).json({ error: result.error.flatten().fieldErrors }); return }

  try {
    await addMemberToRoom(req.params.id, result.data.email, req.user!.userId)
    res.status(201).json({ message: 'Member added' })
  } catch (err) {
    res.status(400).json({ error: (err as Error).message })
  }
}
