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

export async function register(req: Request, res: Response): Promise<void> {
  const result = registerSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten().fieldErrors })
    return
  }

  try {
    const user = await registerUser(result.data.email, result.data.password, result.data.name)
    res.status(201).json({ user })
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
    res.json(tokens)
  } catch (err) {
    res.status(401).json({ error: (err as Error).message })
  }
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body
  if (!refreshToken) {
    res.status(400).json({ error: 'Refresh token required' })
    return
  }

  try {
    const payload = verifyRefreshToken(refreshToken)
    const tokens = generateTokens(payload)
    res.json(tokens)
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token' })
  }
}
