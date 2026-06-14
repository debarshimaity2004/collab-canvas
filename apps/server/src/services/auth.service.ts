import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../db/prisma.js'
import { env } from '../config/env.js'
import type { Session, AuthTokens } from '@collab-canvas/types'

export async function registerUser(email: string, password: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) throw new Error('Email already in use')

  const hashed = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: { email, password: hashed, name },
    select: { id: true, email: true, name: true, createdAt: true },
  })
  return user
}

export async function loginUser(email: string, password: string): Promise<AuthTokens> {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw new Error('Invalid credentials')

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) throw new Error('Invalid credentials')

  return generateTokens({ userId: user.id, email: user.email, name: user.name, iat: 0, exp: 0 })
}

export function generateTokens(payload: Omit<Session, 'iat' | 'exp'>): AuthTokens {
  const base = { userId: payload.userId, email: payload.email, name: payload.name }

  const accessToken = jwt.sign(base, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as jwt.SignOptions)

  const refreshToken = jwt.sign(base, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  } as jwt.SignOptions)

  return { accessToken, refreshToken }
}

export function verifyRefreshToken(token: string): Omit<Session, 'iat' | 'exp'> {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as Omit<Session, 'iat' | 'exp'>
}
