import { Router } from 'express'
import { register, login, refresh } from '../controllers/auth.controller.js'
import { authLimiter } from '../middleware/rate-limit.js'

const router = Router()

router.post('/register', authLimiter, register)
router.post('/login', authLimiter, login)
router.post('/refresh', authLimiter, refresh)

export default router
