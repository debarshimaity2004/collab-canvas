export interface User {
  id: string
  email: string
  name: string
  createdAt: string
}

export interface Session {
  userId: string
  email: string
  name: string
  iat: number
  exp: number
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}
