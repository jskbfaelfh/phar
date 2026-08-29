import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getAuthToken } from '../api/client';

export function usePharmacyLiveSync(
  onEventReceived?: (eventType: 'STOCK_UPDATED' | 'SALE_COMPLETED' | 'STOCK_ENTERED', data: any) => void,
) {
  const [isConnected, setIsConnected] = useState(false);
  const onEventRef = useRef(onEventReceived);
  onEventRef.current = onEventReceived;

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    const socketUrl =
      import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') ||
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:4000'
        : window.location.origin);

    const socket: Socket = io(`${socketUrl}/realtime`, {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 3000,
    });

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('STOCK_UPDATED', (data: any) => {
      if (onEventRef.current) onEventRef.current('STOCK_UPDATED', data);
    });

    socket.on('SALE_COMPLETED', (data: any) => {
      if (onEventRef.current) onEventRef.current('SALE_COMPLETED', data);
    });

    socket.on('STOCK_ENTERED', (data: any) => {
      if (onEventRef.current) onEventRef.current('STOCK_ENTERED', data);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return { isConnected };
}
