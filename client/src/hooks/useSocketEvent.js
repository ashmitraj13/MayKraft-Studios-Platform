import { useEffect, useRef } from 'react';
import { useRealtime } from '../context/RealtimeContext';

// Subscribe to a socket event for the lifetime of a component.
export function useSocketEvent(event, handler) {
  const { socket } = useRealtime();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!socket) return undefined;
    const fn = (...args) => ref.current(...args);
    socket.on(event, fn);
    return () => socket.off(event, fn);
  }, [socket, event]);
}
