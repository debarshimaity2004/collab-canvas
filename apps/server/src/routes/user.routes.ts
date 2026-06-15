import { Router } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth.middleware.js'
import { prisma } from '../db/prisma.js'
import { Response } from 'express'

const router: Router = Router()

router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, email: true, name: true, createdAt: true },
  })
  if (!user) { res.status(404).json({ error: 'User not found' }); return }
  res.json({ user })
})

export default router
