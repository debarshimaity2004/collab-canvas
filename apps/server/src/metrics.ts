import { Registry, Gauge, Counter, collectDefaultMetrics } from 'prom-client'

export const register = new Registry()
register.setDefaultLabels({ app: 'collabcanvas' })

// Node.js process metrics (memory, CPU, event loop lag, etc.)
collectDefaultMetrics({ register })

export const wsConnectionsActive = new Gauge({
  name: 'collabcanvas_ws_connections_active',
  help: 'Number of currently active WebSocket connections',
  registers: [register],
})

export const activeRooms = new Gauge({
  name: 'collabcanvas_active_rooms',
  help: 'Number of rooms with at least one connected user',
  registers: [register],
})

export const canvasOpsTotal = new Counter({
  name: 'collabcanvas_canvas_ops_total',
  help: 'Total Yjs canvas updates applied since server start',
  registers: [register],
})

export const wsConnectionsTotal = new Counter({
  name: 'collabcanvas_ws_connections_total',
  help: 'Total WebSocket connections made since server start',
  registers: [register],
})
