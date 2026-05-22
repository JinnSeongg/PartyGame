import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '../../shared/game'

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io('/', {
  path: '/socket.io',
  autoConnect: true,
  transports: ['websocket'],
})