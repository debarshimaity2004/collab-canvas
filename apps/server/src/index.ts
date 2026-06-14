import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { env } from './config/env.js'
import authRoutes from './routes/auth.routes.js'
import roomRoutes from './routes/room.routes.js'
import userRoutes from './routes/user.routes.js'
import { errorHandler } from './middleware/error.middleware.js'
import { createWsServer } from './websocket/ws-server.js'

const app = express()

app.use(helmet())
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }))
app.use(express.json())

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.use('/api/auth', authRoutes)
app.use('/api/rooms', roomRoutes)
app.use('/api/users', userRoutes)

app.use(errorHandler)

app.listen(env.PORT, () => {
  console.log(`HTTP server running on port ${env.PORT}`)
})

// WebSocket server on PORT + 1 (e.g. 4001)
createWsServer(env.PORT + 1)
