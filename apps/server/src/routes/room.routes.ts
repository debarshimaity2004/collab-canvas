import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware.js'
import { apiLimiter } from '../middleware/rate-limit.js'
import {
  listRooms,
  getRoom,
  createRoomHandler,
  deleteRoomHandler,
  inviteMember,
} from '../controllers/room.controller.js'

const router: Router = Router()

router.use(authenticate, apiLimiter)

router.get('/', listRooms)
router.get('/:id', getRoom)
router.post('/', createRoomHandler)
router.delete('/:id', deleteRoomHandler)
router.post('/:id/members', inviteMember)

export default router
