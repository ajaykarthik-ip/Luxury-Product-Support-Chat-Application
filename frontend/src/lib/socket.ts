import { io, type Socket } from 'socket.io-client';
import { API_URL } from './api';

/**
 * Single shared Socket.IO connection for the whole app. One socket can carry
 * many conversation rooms, so we don't open a new connection per chat — we just
 * join/leave rooms over the same socket.
 *
 * The REST base (API_URL) may include an `/api` suffix in production (nginx
 * routes `/api` → backend). Socket.IO, however, lives at the domain root
 * (`/socket.io`), so we strip a trailing `/api` to get the socket origin.
 *   dev:  API_URL = http://localhost:3000        → socket → http://localhost:3000
 *   prod: API_URL = https://host/api             → socket → https://host
 */
const SOCKET_URL = API_URL.replace(/\/api\/?$/, '');

let socket: Socket | null = null;

export function getSocket(token: string): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: { token }, // verified by the gateway's handshake middleware
      // Default transports (polling → upgrade to websocket) are most robust
      // behind an nginx reverse proxy.
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
