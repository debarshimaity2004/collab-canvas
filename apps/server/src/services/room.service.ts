import { prisma } from '../db/prisma.js'

export async function createRoom(name: string, userId: string) {
  return prisma.room.create({
    data: {
      name,
      members: {
        create: { userId, role: 'owner' },
      },
    },
    include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
  })
}

export async function getRoomsForUser(userId: string) {
  return prisma.room.findMany({
    where: { members: { some: { userId } } },
    include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getRoomById(roomId: string, userId: string) {
  const room = await prisma.room.findFirst({
    where: { id: roomId, members: { some: { userId } } },
    include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
  })
  return room
}

export async function deleteRoom(roomId: string, userId: string) {
  const member = await prisma.roomMember.findFirst({
    where: { roomId, userId, role: 'owner' },
  })
  if (!member) throw new Error('Not authorized to delete this room')

  await prisma.room.delete({ where: { id: roomId } })
}

export async function addMemberToRoom(roomId: string, inviteeEmail: string, requesterId: string) {
  const requester = await prisma.roomMember.findFirst({
    where: { roomId, userId: requesterId, role: { in: ['owner', 'editor'] } },
  })
  if (!requester) throw new Error('Not authorized to invite members')

  const invitee = await prisma.user.findUnique({ where: { email: inviteeEmail } })
  if (!invitee) throw new Error('User not found')

  return prisma.roomMember.upsert({
    where: { userId_roomId: { userId: invitee.id, roomId } },
    update: {},
    create: { userId: invitee.id, roomId, role: 'editor' },
  })
}
