import http from 'http'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { env } from './config/env.js'
import authRoutes from './routes/auth.routes.js'
import roomRoutes from './routes/room.routes.js'
import userRoutes from './routes/user.routes.js'
import { errorHandler } from './middleware/error.middleware.js'
import { createWsServer } from './websocket/ws-server.js'
import { register } from './metrics.js'

const app = express()

app.use(helmet())
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }))
app.use(cookieParser())
app.use(express.json())

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType)
  res.send(await register.metrics())
})

app.use('/api/auth', authRoutes)
app.use('/api/rooms', roomRoutes)
app.use('/api/users', userRoutes)

app.use(errorHandler)

// Single HTTP server shared by Express and the WS server
const server = http.createServer(app)
createWsServer(server)

server.listen(env.PORT, () => {
  console.log(`Server listening on port ${env.PORT} (HTTP + WS)`)
})
