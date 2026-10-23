import { io } from 'socket.io-client';
import { API_ORIGIN } from '../api/http';

// One shared connection; the JWT goes in the handshake so the server can identify us.
export function createSocket(token) {
  return io(API_ORIGIN, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
  });
}

// Promise wrapper around emit-with-ack
export const emitAck = (socket, event, payload, timeout = 8000) =>
  new Promise((resolve, reject) => {
    if (!socket?.connected) return reject(new Error('offline'));
    socket.timeout(timeout).emit(event, payload, (err, res) => {
      if (err) return reject(new Error('The server did not respond'));
      if (!res?.ok) return reject(new Error(res?.message || 'Failed'));
      return resolve(res);
    });
    return undefined;
  });
