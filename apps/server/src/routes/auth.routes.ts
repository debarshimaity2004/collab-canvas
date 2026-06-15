import { Router } from 'express'
import { register, login, refresh, logout } from '../controllers/auth.controller.js'
import { authLimiter } from '../middleware/rate-limit.js'

const router: Router = Router()

router.post('/register', authLimiter, register)
router.post('/login', authLimiter, login)
router.post('/refresh', authLimiter, refresh)
router.post('/logout', logout)

export default router
