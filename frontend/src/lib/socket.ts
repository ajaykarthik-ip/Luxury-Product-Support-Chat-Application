import { io, type Socket } from 'socket.io-client';
import { API_URL } from './api';

/**
 * Single shared Socket.IO connection for the whole app. One socket can carry
 * many conversation rooms, so we don't open a new connection per chat — we just
 * join/leave rooms over the same socket.
 */
let socket: Socket | null = null;

export function getSocket(token: string): Socket {
  if (!socket) {
    socket = io(API_URL, {
      auth: { token }, // verified by the gateway's handshake middleware
      transports: ['websocket'],
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
