import { Redis } from 'ioredis'
import { env } from '../config/env.js'

export const redis = new Redis(env.REDIS_URL)
export const redisSub = new Redis(env.REDIS_URL)

redis.on('error', (err: Error) => console.error('Redis client error:', err))
redisSub.on('error', (err: Error) => console.error('Redis sub error:', err))
