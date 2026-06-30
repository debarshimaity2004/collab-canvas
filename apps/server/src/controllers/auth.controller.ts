import { Request, Response } from 'express'
import { z } from 'zod'
import { registerUser, loginUser, generateTokens, verifyRefreshToken } from '../services/auth.service.js'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

const isProd = process.env.NODE_ENV === 'production'
const COOKIE_OPTS = {
  httpOnly: true,
  secure: isProd,
  // cross-origin in prod (different Render subdomains) requires SameSite=None + Secure
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
}

export async function register(req: Request, res: Response): Promise<void> {
  const result = registerSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten().fieldErrors })
    return
  }

  try {
    await registerUser(result.data.email, result.data.password, result.data.name)
    const tokens = await loginUser(result.data.email, result.data.password)
    res.cookie('refresh_token', tokens.refreshToken, COOKIE_OPTS)
    res.status(201).json({
      accessToken: tokens.accessToken,
      userId: tokens.userId,
      name: tokens.name,
    })
  } catch (err) {
    res.status(409).json({ error: (err as Error).message })
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = loginSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten().fieldErrors })
    return
  }

  try {
    const tokens = await loginUser(result.data.email, result.data.password)
    res.cookie('refresh_token', tokens.refreshToken, COOKIE_OPTS)
    res.json({
      accessToken: tokens.accessToken,
      userId: tokens.userId,
      name: tokens.name,
    })
  } catch (err) {
    res.status(401).json({ error: (err as Error).message })
  }
}

// Accepts refresh token from httpOnly cookie or body (WS/mobile clients)
export async function refresh(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.refresh_token ?? req.body?.refreshToken
  if (!token) {
    res.status(400).json({ error: 'Refresh token required' })
    return
  }

  try {
    const payload = verifyRefreshToken(token)
    const tokens = generateTokens(payload)
    res.cookie('refresh_token', tokens.refreshToken, COOKIE_OPTS)
    res.json({
      accessToken: tokens.accessToken,
      userId: tokens.userId,
      name: tokens.name,
    })
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token' })
  }
}

export async function logout(_req: Request, res: Response): Promise<void> {
  res.clearCookie('refresh_token', { path: '/' })
  res.status(204).send()
}
