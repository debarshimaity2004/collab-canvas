export const WS_EVENTS = {
  // Client → Server
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  CANVAS_UPDATE: 'canvas_update',
  CURSOR_MOVE: 'cursor_move',

  // Server → Client
  ROOM_STATE: 'room_state',
  USER_JOINED: 'user_joined',
  USER_LEFT: 'user_left',
  PRESENCE_UPDATE: 'presence_update',
  ERROR: 'error',
} as const

export type WsEvent = (typeof WS_EVENTS)[keyof typeof WS_EVENTS]

export interface WsMessage<T = unknown> {
  event: WsEvent
  payload: T
}

export interface CursorPosition {
  userId: string
  name: string
  x: number
  y: number
  color: string
}
