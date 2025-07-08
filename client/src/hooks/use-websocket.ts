import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { WSMessage } from '@shared/schema';

export function useWebSocket(onMessage?: (message: WSMessage) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Memoize the onMessage callback to prevent unnecessary re-connections
  const memoizedOnMessage = useCallback((message: WSMessage) => {
    if (onMessage) {
      onMessage(message);
    }
  }, [onMessage]);

  useEffect(() => {
    // Only create socket if it doesn't exist
    if (!socketRef.current) {
      const socket = io(window.location.origin, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('Socket.io connected');
        setIsConnected(true);
        setError(null);
      });

      socket.on('message', (message: WSMessage) => {
        try {
          memoizedOnMessage(message);
        } catch (err) {
          console.error('Failed to handle socket message:', err);
        }
      });

      socket.on('disconnect', (reason) => {
        console.log('Socket.io disconnected:', reason);
        setIsConnected(false);
        
        // Only set error for unexpected disconnections
        if (reason === 'io server disconnect') {
          setError('Server disconnected');
        }
      });

      socket.on('connect_error', (err) => {
        console.error('Socket.io connection error:', err);
        setError('Connection error');
      });

      socket.on('error', (err) => {
        console.error('Socket.io error:', err);
        setError('Socket error');
      });
    }

    return () => {
      // Clean up socket on unmount
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [memoizedOnMessage]);

  const sendMessage = useCallback((message: WSMessage) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('message', message);
    } else {
      console.error('Socket is not connected');
    }
  }, []);

  return { isConnected, error, sendMessage };
}
