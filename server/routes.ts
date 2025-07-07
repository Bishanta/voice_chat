import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { wsMessageSchema, type WSMessage } from "@shared/schema";
import { z } from "zod";

interface WSClient {
  ws: WebSocket;
  userId?: string;
  isAdmin?: boolean;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  const clients = new Map<string, WSClient>();
  const userSockets = new Map<string, string>(); // userId -> socketId

  // REST API routes
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/users/customers", async (req, res) => {
    try {
      const customers = await storage.getCustomerUsers();
      res.json(customers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { customerId } = req.body;
      const user = await storage.getUserByCustomerId(customerId);
      
      if (!user) {
        return res.status(401).json({ error: "Invalid customer ID" });
      }

      // Update user status to available
      await storage.updateUserStatus(customerId, "available");
      
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/calls", async (req, res) => {
    try {
      const { callerId, receiverId } = req.body;
      
      const call = await storage.createCall({
        callerId,
        receiverId,
        status: "initiated",
      });

      res.json(call);
    } catch (error) {
      res.status(500).json({ error: "Failed to create call" });
    }
  });

  app.patch("/api/calls/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { status, duration } = req.body;
      
      const endedAt = status === "ended" ? new Date() : undefined;
      const call = await storage.updateCallStatus(parseInt(id), status, endedAt, duration);
      
      if (!call) {
        return res.status(404).json({ error: "Call not found" });
      }

      res.json(call);
    } catch (error) {
      res.status(500).json({ error: "Failed to update call" });
    }
  });

  app.get("/api/calls/user/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const calls = await storage.getUserCalls(parseInt(userId));
      res.json(calls);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user calls" });
    }
  });

  // WebSocket handling
  wss.on('connection', (ws: WebSocket) => {
    const socketId = generateSocketId();
    clients.set(socketId, { ws });

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        const parsedMessage = wsMessageSchema.parse(message);
        
        await handleWSMessage(socketId, parsedMessage);
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      const client = clients.get(socketId);
      if (client && client.userId) {
        userSockets.delete(client.userId);
        // Update user status to offline
        storage.getUserByCustomerId(client.userId).then(user => {
          if (user) {
            storage.updateUserStatus(user.customerId, "offline");
            broadcastUserStatusUpdate(user.customerId, "offline");
          }
        });
      }
      clients.delete(socketId);
    });
  });

  async function handleWSMessage(socketId: string, message: WSMessage) {
    const client = clients.get(socketId);
    if (!client) return;

    switch (message.type) {
      case 'call_initiated':
        await handleCallInitiated(socketId, message.data);
        break;
      case 'call_accepted':
        await handleCallAccepted(socketId, message.data);
        break;
      case 'call_declined':
        await handleCallDeclined(socketId, message.data);
        break;
      case 'call_ended':
        await handleCallEnded(socketId, message.data);
        break;
      case 'webrtc_offer':
        await handleWebRTCOffer(socketId, message.data);
        break;
      case 'webrtc_answer':
        await handleWebRTCAnswer(socketId, message.data);
        break;
      case 'webrtc_ice_candidate':
        await handleWebRTCIceCandidate(socketId, message.data);
        break;
      case 'user_status_update':
        await handleUserStatusUpdate(socketId, message.data);
        break;
    }
  }

  async function handleCallInitiated(socketId: string, data: any) {
    const client = clients.get(socketId);
    if (!client) return;

    // Register user if not already registered
    if (!client.userId) {
      client.userId = data.caller.id;
      userSockets.set(data.caller.id, socketId);
    }

    // Find receiver socket
    const receiverSocketId = userSockets.get(data.receiver.id);
    if (receiverSocketId) {
      const receiverClient = clients.get(receiverSocketId);
      if (receiverClient && receiverClient.ws.readyState === WebSocket.OPEN) {
        receiverClient.ws.send(JSON.stringify({
          type: 'call_initiated',
          data: data,
        }));
      }
    }
  }

  async function handleCallAccepted(socketId: string, data: any) {
    // Broadcast to all participants
    broadcastToCall(data.callId, {
      type: 'call_accepted',
      data: data,
    });
  }

  async function handleCallDeclined(socketId: string, data: any) {
    broadcastToCall(data.callId, {
      type: 'call_declined',
      data: data,
    });
  }

  async function handleCallEnded(socketId: string, data: any) {
    broadcastToCall(data.callId, {
      type: 'call_ended',
      data: data,
    });
  }

  async function handleWebRTCOffer(socketId: string, data: any) {
    broadcastToCall(data.callId, {
      type: 'webrtc_offer',
      data: data,
    }, socketId);
  }

  async function handleWebRTCAnswer(socketId: string, data: any) {
    broadcastToCall(data.callId, {
      type: 'webrtc_answer',
      data: data,
    }, socketId);
  }

  async function handleWebRTCIceCandidate(socketId: string, data: any) {
    broadcastToCall(data.callId, {
      type: 'webrtc_ice_candidate',
      data: data,
    }, socketId);
  }

  async function handleUserStatusUpdate(socketId: string, data: any) {
    const client = clients.get(socketId);
    if (!client) return;

    client.userId = data.userId;
    userSockets.set(data.userId, socketId);

    await storage.updateUserStatus(data.userId, data.status);
    broadcastUserStatusUpdate(data.userId, data.status);
  }

  function broadcastToCall(callId: string, message: any, excludeSocketId?: string) {
    clients.forEach((client, socketId) => {
      if (excludeSocketId && socketId === excludeSocketId) return;
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  function broadcastUserStatusUpdate(userId: string, status: string) {
    const message = {
      type: 'user_status_update',
      data: { userId, status },
    };

    clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  function generateSocketId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  return httpServer;
}
