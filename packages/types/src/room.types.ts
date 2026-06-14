export type RoomRole = 'owner' | 'editor' | 'viewer'

export interface Room {
  id: string
  name: string
  createdAt: string
}

export interface RoomMember {
  userId: string
  roomId: string
  role: RoomRole
  user: {
    id: string
    name: string
    email: string
  }
}

export interface RoomState {
  room: Room
  members: RoomMember[]
  onlineCount: number
}
