import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { WSMessage, User } from '@shared/schema';
import e from 'express';

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const userRef = useRef<User | undefined>(undefined);

  const addSocketEvents = useCallback((socket: Socket) => {
    socket.on('connect', () => {
      console.log('Socket.io connected', userRef.current);
      setIsConnected(true);
      setError(null);

      if (userRef.current && !userRef.current.isAdmin) {
        console.log('sendMessage triggered', userRef.current);
        sendMessage({
          type: 'user_status_update',
          data: {
            userId: userRef.current.customerId,
            status: 'available',
          },
        });
      }
      else if (userRef.current && userRef.current.isAdmin) {
        sendMessage({
          type: 'admin_register',
          data: {
            adminId: userRef.current.customerId,
          },
        });
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
  }, []);

  const initSocket = async (onMessage?: (message: WSMessage) => void, user?: User) => {
    if (!socketRef.current) {
      const newSocket = io(window.location.origin, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });
      socketRef.current = newSocket;
      addSocketEvents(newSocket);
      userRef.current = user;
      if (onMessage) {
        newSocket.on('message', onMessage);
      }
      console.log('Socket.io initialized', newSocket);
      return newSocket;
    }
    addSocketEvents(socketRef.current);
    return socketRef.current;
  };

  const sendMessage = useCallback((message: WSMessage) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('message', message);
    } else {
      console.error('Socket is not connected from send message', socketRef.current);
      // Try to reconnect if socket is disconnected
      if (socketRef.current && !socketRef.current.connected) {
        socketRef.current.connect();
      }
    }
  }, []);

  return { initSocket, isConnected, error, sendMessage };
}
