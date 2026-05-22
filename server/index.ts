import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Server } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from '../shared/game.js'
import { RoomManager } from './roomManager.js'

const PORT = Number(process.env.PORT || 3001)
const currentDir = dirname(fileURLToPath(import.meta.url))
const clientDistDir = join(currentDir, '..', 'client')

const httpServer = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ ok: true }))
    return
  }

  const requestPath = request.url === '/' ? 'index.html' : request.url?.replace(/^\//, '') || 'index.html'
  const filePath = join(clientDistDir, requestPath)
  const fallbackPath = join(clientDistDir, 'index.html')

  if (existsSync(filePath) && extname(filePath)) {
    const contentType = filePath.endsWith('.js')
      ? 'text/javascript; charset=utf-8'
      : filePath.endsWith('.css')
        ? 'text/css; charset=utf-8'
        : filePath.endsWith('.svg')
          ? 'image/svg+xml'
          : 'text/html; charset=utf-8'

    response.writeHead(200, { 'Content-Type': contentType })
    response.end(readFileSync(filePath))
    return
  }

  if (existsSync(fallbackPath)) {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end(readFileSync(fallbackPath))
    return
  }

  response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
  response.end('Party game server is running.')
})

const allowedOrigins = new Set([
  'https://jinn.ing',
  'https://www.jinn.ing',
  'http://jinn.ing',
  'http://www.jinn.ing',
  'http://161.33.4.141',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
])
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true)
        return
      }
      callback(new Error('Origin is not allowed'))
    },
  },
})

const roomManager = new RoomManager(io)

io.on('connection', (socket) => {
  roomManager.bindSocket(socket)
})

httpServer.listen(PORT, '127.0.0.1', () => {
  console.log(`Realtime server listening on http://127.0.0.1:${PORT}`)
})
