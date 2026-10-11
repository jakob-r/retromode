import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@retromode/shared'
import { getClientId } from '../lib/identity'

export type RetroSocket = Socket<ServerToClientEvents, ClientToServerEvents>

/** Same-origin socket: Vite proxies /socket.io in dev, Fastify serves it in production. */
export function createSocket(): RetroSocket {
  return io({ auth: { clientId: getClientId() }, transports: ['websocket', 'polling'] })
}
